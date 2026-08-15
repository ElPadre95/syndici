/**
 * Compte du lot (B4) — relevé chronologique DÉBIT / CRÉDIT / SOLDE. Les appels de
 * charges débitent le compte, les règlements le créditent, une annulation (paiement
 * négatif) le re-débite. Le solde de clôture = total appelé − net réglé = reste dû
 * du lot. Rien n'est stocké : tout est DÉRIVÉ des appels et des paiements immuables.
 */
import { forResidence } from '@/server/db/tenant';
import { getBaseClient } from '@/server/db/client';
import { prismaExecutor } from '@/server/db/sql';
import { listResidents } from '@/server/auth/person-access';
import type { ActiveContext } from '@/server/auth/context';

export type LedgerKind = 'charge' | 'payment' | 'reversal' | 'latefee' | 'latefee_reversal';

export interface LedgerEntry {
  date: string; // ISO
  kind: LedgerKind;
  periodYear: number | null; // pour un appel
  periodMonth: number | null;
  method: string | null; // pour un règlement / une annulation
  receiptId: string | null;
  receiptNumber: string | null;
  receiptVoided: boolean;
  debitMinor: number;
  creditMinor: number;
  balanceMinor: number; // solde courant APRÈS cette écriture
}

export interface LotAccount {
  lotReference: string;
  ownerName: string | null;
  residence: { name: string; orgName: string | null };
  entries: LedgerEntry[];
  totalDebitMinor: number;
  totalCreditMinor: number;
  balanceMinor: number; // = totalDebit − totalCredit (reste dû ; négatif = avoir)
}

// ── Cœur PUR (testable sans base) ────────────────────────────────────────────

export interface LedgerCall {
  periodYear: number;
  periodMonth: number;
  dueDate: Date;
  amountMinor: number;
}
export interface LedgerPayment {
  id: string;
  method: string;
  amountMinor: number; // < 0 pour une annulation
  receivedAt: Date;
  reversesPaymentId: string | null;
}
export interface LedgerReceiptRef {
  id: string;
  number: string;
  voided: boolean;
}
export interface LedgerLateFee {
  appliedAt: Date;
  amountMinor: number; // < 0 pour une annulation (écriture inverse)
  reversesLateFeeId: string | null;
}

export interface Ledger {
  entries: LedgerEntry[];
  totalDebitMinor: number;
  totalCreditMinor: number;
  balanceMinor: number;
}

/**
 * Construit le grand livre du lot : appels (débit), règlements (crédit), annulations
 * (re-débit), triés chronologiquement (appel avant règlement à date égale), avec un
 * solde courant. Fonction PURE — aucune dépendance base.
 */
export function buildLedger(
  calls: readonly LedgerCall[],
  payments: readonly LedgerPayment[],
  receiptByPayment: ReadonlyMap<string, LedgerReceiptRef>,
  lateFees: readonly LedgerLateFee[] = [],
): Ledger {
  type Raw = Omit<LedgerEntry, 'balanceMinor'>;
  const raw: Raw[] = [];
  for (const c of calls) {
    raw.push({
      date: c.dueDate.toISOString(),
      kind: 'charge',
      periodYear: c.periodYear,
      periodMonth: c.periodMonth,
      method: null,
      receiptId: null,
      receiptNumber: null,
      receiptVoided: false,
      debitMinor: c.amountMinor,
      creditMinor: 0,
    });
  }
  for (const p of payments) {
    const isReversal = p.reversesPaymentId != null;
    const rec = receiptByPayment.get(p.id);
    raw.push({
      date: p.receivedAt.toISOString(),
      kind: isReversal ? 'reversal' : 'payment',
      periodYear: null,
      periodMonth: null,
      method: p.method,
      receiptId: rec?.id ?? null,
      receiptNumber: rec?.number ?? null,
      receiptVoided: rec?.voided ?? false,
      // Un paiement (montant ≥ 0) crédite ; une annulation (montant < 0) re-débite.
      debitMinor: p.amountMinor < 0 ? -p.amountMinor : 0,
      creditMinor: p.amountMinor >= 0 ? p.amountMinor : 0,
    });
  }

  for (const lf of lateFees) {
    const isReversal = lf.reversesLateFeeId != null;
    raw.push({
      date: lf.appliedAt.toISOString(),
      kind: isReversal ? 'latefee_reversal' : 'latefee',
      periodYear: null,
      periodMonth: null,
      method: null,
      receiptId: null,
      receiptNumber: null,
      receiptVoided: false,
      // Un frais (montant > 0) débite ; son annulation (montant < 0) re-crédite.
      debitMinor: lf.amountMinor > 0 ? lf.amountMinor : 0,
      creditMinor: lf.amountMinor < 0 ? -lf.amountMinor : 0,
    });
  }

  // À date égale : débits d'abord (appel de charges, frais de retard), crédits ensuite.
  const order = (k: LedgerKind) => (k === 'charge' || k === 'latefee' ? 0 : 1);
  raw.sort((a, b) => a.date.localeCompare(b.date) || order(a.kind) - order(b.kind));

  let balance = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const entries: LedgerEntry[] = raw.map((e) => {
    balance += e.debitMinor - e.creditMinor;
    totalDebit += e.debitMinor;
    totalCredit += e.creditMinor;
    return { ...e, balanceMinor: balance };
  });
  return {
    entries,
    totalDebitMinor: totalDebit,
    totalCreditMinor: totalCredit,
    balanceMinor: balance,
  };
}

/** Relevé de compte d'un lot, ou `null` si le lot n'appartient pas à la résidence. */
export async function getLotAccount(ctx: ActiveContext, lotId: string): Promise<LotAccount | null> {
  const scoped = forResidence(ctx.residenceId);
  const lot = await scoped.lot.findUnique({ where: { id: lotId }, select: { reference: true } });
  if (!lot) return null;

  const [calls, payments, lateFees, residence, mandate] = await Promise.all([
    scoped.chargeCall.findMany({
      where: { lotId, voidedAt: null },
      select: { periodYear: true, periodMonth: true, dueDate: true, amountMinor: true },
    }),
    scoped.payment.findMany({
      where: { lotId },
      select: {
        id: true,
        method: true,
        amountMinor: true,
        receivedAt: true,
        reversesPaymentId: true,
      },
    }),
    scoped.lateFee.findMany({
      where: { lotId },
      select: { appliedAt: true, amountMinor: true, reversesLateFeeId: true },
    }),
    getBaseClient().residence.findUnique({
      where: { id: ctx.residenceId },
      select: { name: true },
    }),
    scoped.mandate.findFirst({
      where: { status: 'ACTIVE' },
      select: { organization: { select: { name: true } } },
    }),
  ]);
  if (!residence) return null;

  const receipts = payments.length
    ? await scoped.receipt.findMany({
        where: { paymentId: { in: payments.map((p) => p.id) } },
        select: { id: true, number: true, paymentId: true, voidedAt: true },
      })
    : [];
  const receiptByPayment = new Map(
    receipts.map((r) => [r.paymentId, { id: r.id, number: r.number, voided: r.voidedAt != null }]),
  );

  // Propriétaire courant (rattachement OWNER actif) — nom résolu via la couche d'accès.
  const nameById = new Map<string, string>();
  for (const p of await listResidents(prismaExecutor(), ctx)) {
    nameById.set(p.id, `${p.firstName} ${p.lastName}`.trim());
  }
  const owner = await scoped.lotAttachment.findFirst({
    where: { lotId, endDate: null, role: 'OWNER' },
    select: { personId: true },
  });

  const ledger = buildLedger(calls, payments, receiptByPayment, lateFees);
  return {
    lotReference: lot.reference,
    ownerName: owner?.personId ? (nameById.get(owner.personId) ?? null) : null,
    residence: { name: residence.name, orgName: mandate?.organization?.name ?? null },
    ...ledger,
  };
}
