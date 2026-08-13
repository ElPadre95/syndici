/**
 * Encaissement (B2). Enregistrer un paiement sur un appel de charges (espèces en
 * priorité au Maroc, chèque, virement — JAMAIS carte). Un paiement est IMMUABLE :
 * pas de modification ni de suppression ; l'annulation passe par une ÉCRITURE INVERSE
 * (paiement négatif liant l'original), tracée au journal d'audit avec son motif. Le
 * statut d'un appel reste DÉRIVÉ (jamais écrit) : plusieurs paiements et des partiels
 * fonctionnent naturellement.
 *
 * Écriture executor-based (SQL brut typé, cf. §5 bis) → testable PGlite ET Postgres réel.
 */
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor, type TxRunner } from '@/server/db/sql';
import { listResidents } from '@/server/auth/person-access';
import { NUMBER_SEQUENCE_UPSERT_SQL, formatReceiptNumber } from './numbering';
import {
  deriveSettlementState,
  deriveTemporalState,
  remainingDueMinor,
  daysLate,
  type SettlementState,
  type TemporalState,
} from './status';
import type { ActiveContext } from '@/server/auth/context';

export type ManualMethod = 'ESPECES' | 'CHEQUE' | 'VIREMENT';
export const MANUAL_METHODS: readonly ManualMethod[] = ['ESPECES', 'CHEQUE', 'VIREMENT'];

const INSERT_PAYMENT = `
  INSERT INTO "Payment"
    (id,"residenceId","lotId","payerPersonId","recordedByPersonId",method,"amountMinor",
     "receivedAt",reference,note,"reversesPaymentId","createdAt")
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5::"PaymentMethod",$6,$7::timestamp,$8,$9,$10,now())
  RETURNING id`;

const INSERT_ALLOCATION = `
  INSERT INTO "PaymentAllocation" (id,"residenceId","paymentId","chargeCallId","amountMinor","createdAt")
  VALUES (gen_random_uuid(),$1,$2,$3,$4,now())`;

const INSERT_AUDIT = `
  INSERT INTO "AuditLog" (id,"residenceId","actorPersonId",action,"entityType","entityId",after,at)
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6::jsonb,now())`;

const INSERT_RECEIPT = `
  INSERT INTO "Receipt"
    (id,"residenceId",exercice,sequence,number,"paymentId","lotId","amountMinor","issuedAt")
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,now())
  RETURNING id`;

/** Voide le reçu d'un paiement (le numéro est conservé, jamais réutilisé). */
const VOID_RECEIPT = `
  UPDATE "Receipt" SET "voidedAt" = now()
   WHERE "paymentId" = $1 AND "voidedAt" IS NULL`;

export interface RecordPaymentInput {
  residenceId: string;
  lotId: string;
  chargeCallId: string;
  payerPersonId: string | null;
  recordedByPersonId: string;
  method: ManualMethod;
  amountMinor: number;
  receivedAt: Date;
  reference: string | null;
  note: string | null;
  actorPersonId: string;
}

/** Écrit un paiement + son allocation à l'appel + une trace d'audit. Renvoie l'id. */
export async function writePayment(runner: TxRunner, input: RecordPaymentInput): Promise<string> {
  return runner.transaction(async (tx) => {
    const rows = await tx.query<{ id: string }>(INSERT_PAYMENT, [
      input.residenceId,
      input.lotId,
      input.payerPersonId,
      input.recordedByPersonId,
      input.method,
      input.amountMinor,
      input.receivedAt.toISOString(),
      input.reference,
      input.note,
      null, // reversesPaymentId
    ]);
    const paymentId = rows[0]!.id;
    await tx.query(INSERT_ALLOCATION, [
      input.residenceId,
      paymentId,
      input.chargeCallId,
      input.amountMinor,
    ]);
    await tx.query(INSERT_AUDIT, [
      input.residenceId,
      input.actorPersonId,
      'payment.record',
      'Payment',
      paymentId,
      JSON.stringify({
        chargeCallId: input.chargeCallId,
        amountMinor: input.amountMinor,
        method: input.method,
      }),
    ]);

    // Reçu (B3) : numéro séquentiel CONTINU et SANS TROU par (résidence, exercice),
    // émis DANS la même transaction que le paiement. L'exercice est l'année de la
    // date d'encaissement. Un rollback annule aussi l'incrément du compteur.
    const exercice = input.receivedAt.getUTCFullYear();
    const seq = (
      await tx.query<{ lastValue: number }>(NUMBER_SEQUENCE_UPSERT_SQL, [
        input.residenceId,
        exercice,
        'RECU',
      ])
    )[0]!.lastValue;
    const number = formatReceiptNumber(exercice, seq);
    const receiptId = (
      await tx.query<{ id: string }>(INSERT_RECEIPT, [
        input.residenceId,
        exercice,
        seq,
        number,
        paymentId,
        input.lotId,
        input.amountMinor,
      ])
    )[0]!.id;
    await tx.query(INSERT_AUDIT, [
      input.residenceId,
      input.actorPersonId,
      'receipt.issue',
      'Receipt',
      receiptId,
      JSON.stringify({ number, amountMinor: input.amountMinor }),
    ]);
    return paymentId;
  });
}

export type ReverseResult =
  | { ok: true; reversalId: string }
  | { ok: false; reason: 'not_found' | 'already_reversed' | 'is_reversal' };

/**
 * Annule un paiement par ÉCRITURE INVERSE : crée un paiement négatif liant l'original
 * et des allocations négatives (le statut de l'appel redevient donc « non réglé »/
 * « partiel » par dérivation). L'original n'est jamais touché. Refuse d'annuler un
 * paiement déjà annulé ou qui est lui-même une annulation.
 */
export async function reversePayment(
  runner: TxRunner,
  params: {
    residenceId: string;
    paymentId: string;
    reason: string;
    actorPersonId: string;
    now?: Date;
  },
): Promise<ReverseResult> {
  const now = params.now ?? new Date();
  return runner.transaction(async (tx) => {
    const orig = (
      await tx.query<{
        id: string;
        lotId: string | null;
        payerPersonId: string | null;
        method: string;
        amountMinor: number;
        reversesPaymentId: string | null;
      }>(
        `SELECT id,"lotId","payerPersonId",method,"amountMinor","reversesPaymentId"
           FROM "Payment" WHERE id = $1 AND "residenceId" = $2 FOR UPDATE`,
        [params.paymentId, params.residenceId],
      )
    )[0];
    if (!orig) return { ok: false as const, reason: 'not_found' as const };
    if (orig.reversesPaymentId) return { ok: false as const, reason: 'is_reversal' as const };
    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM "Payment" WHERE "reversesPaymentId" = $1 LIMIT 1`,
      [params.paymentId],
    );
    if (existing[0]) return { ok: false as const, reason: 'already_reversed' as const };

    const allocs = await tx.query<{ chargeCallId: string; amountMinor: number }>(
      `SELECT "chargeCallId","amountMinor" FROM "PaymentAllocation" WHERE "paymentId" = $1`,
      [params.paymentId],
    );

    const reversalId = (
      await tx.query<{ id: string }>(INSERT_PAYMENT, [
        params.residenceId,
        orig.lotId,
        orig.payerPersonId,
        params.actorPersonId,
        orig.method,
        -orig.amountMinor,
        now.toISOString(),
        null,
        params.reason,
        orig.id,
      ])
    )[0]!.id;

    for (const a of allocs) {
      await tx.query(INSERT_ALLOCATION, [
        params.residenceId,
        reversalId,
        a.chargeCallId,
        -a.amountMinor,
      ]);
    }
    // Le reçu de l'encaissement annulé est VOIDÉ (marqué annulé) : son numéro reste
    // consommé (séquence sans trou), il ne sera jamais réutilisé ni réimprimé comme valide.
    await tx.query(VOID_RECEIPT, [orig.id]);
    await tx.query(INSERT_AUDIT, [
      params.residenceId,
      params.actorPersonId,
      'payment.reverse',
      'Payment',
      reversalId,
      JSON.stringify({ reverses: orig.id, amountMinor: -orig.amountMinor, reason: params.reason }),
    ]);
    return { ok: true as const, reversalId };
  });
}

// ── Lecture pour la fiche du lot ─────────────────────────────────────────────

export interface LotCall {
  id: string;
  year: number;
  month: number;
  dueDate: string;
  amountMinor: number;
  allocatedMinor: number;
  remainingMinor: number;
  settlement: SettlementState;
  temporal: TemporalState;
  daysLate: number;
}

export interface LotPayment {
  id: string;
  method: string;
  amountMinor: number;
  receivedAt: string;
  reference: string | null;
  note: string | null;
  recordedByName: string | null;
  isReversal: boolean;
  reversed: boolean;
  receiptId: string | null;
  receiptNumber: string | null;
  receiptVoided: boolean;
}

export interface LotFinance {
  calls: LotCall[];
  payments: LotPayment[];
}

/** Appels + paiements d'un lot (statuts dérivés), pour la fiche. */
export async function getLotFinance(
  ctx: ActiveContext,
  lotId: string,
  now: Date = new Date(),
): Promise<LotFinance> {
  const scoped = forResidence(ctx.residenceId);
  const [calls, payments] = await Promise.all([
    scoped.chargeCall.findMany({
      where: { lotId, voidedAt: null },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      select: { id: true, periodYear: true, periodMonth: true, dueDate: true, amountMinor: true },
    }),
    scoped.payment.findMany({
      where: { lotId },
      orderBy: { receivedAt: 'desc' },
      select: {
        id: true,
        method: true,
        amountMinor: true,
        receivedAt: true,
        reference: true,
        note: true,
        recordedByPersonId: true,
        reversesPaymentId: true,
      },
    }),
  ]);

  const callIds = calls.map((c) => c.id);
  const allocs = callIds.length
    ? await scoped.paymentAllocation.findMany({
        where: { chargeCallId: { in: callIds } },
        select: { chargeCallId: true, amountMinor: true },
      })
    : [];
  const allocByCall = new Map<string, number>();
  for (const a of allocs)
    allocByCall.set(a.chargeCallId, (allocByCall.get(a.chargeCallId) ?? 0) + a.amountMinor);

  const nameById = new Map<string, string>();
  for (const p of await listResidents(prismaExecutor(), ctx)) {
    nameById.set(p.id, `${p.firstName} ${p.lastName}`.trim());
  }
  const reversedSet = new Set(
    payments.filter((p) => p.reversesPaymentId).map((p) => p.reversesPaymentId as string),
  );

  const receipts = payments.length
    ? await scoped.receipt.findMany({
        where: { paymentId: { in: payments.map((p) => p.id) } },
        select: { id: true, number: true, paymentId: true, voidedAt: true },
      })
    : [];
  const receiptByPayment = new Map(receipts.map((r) => [r.paymentId, r]));

  return {
    calls: calls.map((c) => {
      const alloc = Math.max(0, allocByCall.get(c.id) ?? 0);
      const capped = Math.min(alloc, c.amountMinor);
      return {
        id: c.id,
        year: c.periodYear,
        month: c.periodMonth,
        dueDate: c.dueDate.toISOString(),
        amountMinor: c.amountMinor,
        allocatedMinor: alloc,
        remainingMinor: remainingDueMinor(c.amountMinor, alloc),
        settlement: deriveSettlementState(c.amountMinor, capped),
        temporal: deriveTemporalState(c.dueDate, now),
        daysLate: daysLate(c.dueDate, now),
      };
    }),
    payments: payments.map((p) => {
      const receipt = receiptByPayment.get(p.id);
      return {
        id: p.id,
        method: p.method,
        amountMinor: p.amountMinor,
        receivedAt: p.receivedAt.toISOString(),
        reference: p.reference,
        note: p.note,
        recordedByName: p.recordedByPersonId ? (nameById.get(p.recordedByPersonId) ?? null) : null,
        isReversal: p.reversesPaymentId != null,
        reversed: reversedSet.has(p.id),
        receiptId: receipt?.id ?? null,
        receiptNumber: receipt?.number ?? null,
        receiptVoided: receipt?.voidedAt != null,
      };
    }),
  };
}
