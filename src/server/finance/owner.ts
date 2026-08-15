/**
 * Lectures « côté propriétaire » (tranche G) — SÛRES pour un rôle PROPRIETAIRE.
 *
 * `getLotFinance` (vue syndic) résout le nom de l'enregistreur via `listResidents`, qui
 * LÈVE pour un non-staff. Ici on ne lit que ce qu'un propriétaire a le droit de voir de
 * SON lot (appels de charges + statut dérivé), sans jamais toucher au modèle Person
 * (mur d'étanchéité) et en vérifiant qu'il DÉTIENT bien le lot (`charge.view.own`).
 *
 * L'indicateur collectif est identity-free : des NOMBRES (voisins à jour / en attente),
 * jamais l'identité de quiconque.
 */
import { forResidence } from '@/server/db/tenant';
import { getBaseClient } from '@/server/db/client';
import type { ActiveContext } from '@/server/auth/context';
import {
  deriveSettlementState,
  deriveTemporalState,
  daysLate,
  remainingDueMinor,
  type SettlementState,
  type TemporalState,
} from './status';
import { buildLedger, type LotAccount } from './account';
import type { ReceiptView } from './receipts';

export interface OwnerLot {
  lotId: string;
  reference: string;
  /** false = charges déléguées au locataire (le propriétaire reste concerné mais ne paie pas). */
  isChargePayer: boolean;
}

export interface OwnerCharge {
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

export interface ChargeSummary {
  totalRemainingMinor: number;
  nextDueDate: string | null;
  maxDaysLate: number;
  overdue: boolean;
  settledAll: boolean;
}

export interface CollectionCounts {
  paidCount: number;
  pendingCount: number;
  totalLots: number;
  period: { year: number; month: number } | null;
}

// ── Cœurs PURS (testés) ──────────────────────────────────────────────────────

/** Résume les appels d'UN lot pour le bandeau d'accueil : reste dû, prochaine échéance, retard. */
export function summarizeCharges(
  charges: Pick<
    OwnerCharge,
    'remainingMinor' | 'dueDate' | 'temporal' | 'daysLate' | 'settlement'
  >[],
): ChargeSummary {
  const unsettled = charges.filter((c) => c.settlement !== 'SETTLED');
  const overdue = unsettled.filter((c) => c.temporal === 'OVERDUE');
  return {
    totalRemainingMinor: unsettled.reduce((s, c) => s + c.remainingMinor, 0),
    nextDueDate: unsettled.length
      ? unsettled.map((c) => c.dueDate).sort((a, b) => a.localeCompare(b))[0]!
      : null,
    maxDaysLate: overdue.reduce((m, c) => Math.max(m, c.daysLate), 0),
    overdue: overdue.length > 0,
    settledAll: unsettled.length === 0,
  };
}

/** Compte les lots à jour (SETTLED) vs en attente pour une période — NOMBRES seulement. */
export function countSettledLots(calls: { amountMinor: number; allocatedMinor: number }[]): {
  paidCount: number;
  pendingCount: number;
  totalLots: number;
} {
  let paid = 0;
  for (const c of calls) {
    const capped = Math.min(Math.max(0, c.allocatedMinor), c.amountMinor);
    if (deriveSettlementState(c.amountMinor, capped) === 'SETTLED') paid++;
  }
  return { paidCount: paid, pendingCount: calls.length - paid, totalLots: calls.length };
}

// ── Lectures scopées (résidence active) ──────────────────────────────────────

/** Lots que le propriétaire DÉTIENT dans la résidence active (jamais ceux des voisins). */
export async function listOwnerLots(ctx: ActiveContext): Promise<OwnerLot[]> {
  const rows = await forResidence(ctx.residenceId).lotAttachment.findMany({
    where: { personId: ctx.personId, role: 'OWNER', endDate: null },
    orderBy: { lot: { reference: 'asc' } },
    select: { isChargePayer: true, lotId: true, lot: { select: { reference: true } } },
  });
  return rows.map((r) => ({
    lotId: r.lotId,
    reference: r.lot.reference,
    isChargePayer: r.isChargePayer,
  }));
}

async function ownsLot(ctx: ActiveContext, lotId: string): Promise<boolean> {
  const a = await forResidence(ctx.residenceId).lotAttachment.findFirst({
    where: { lotId, personId: ctx.personId, role: 'OWNER', endDate: null },
    select: { id: true },
  });
  return a != null;
}

/**
 * Appels de charges d'UN lot du propriétaire, avec statut dérivé, plus récent d'abord.
 * Vérifie la détention (sinon renvoie vide : un propriétaire ne voit jamais les charges
 * d'un lot voisin). Aucun accès au modèle Person.
 */
export async function getOwnerLotCharges(
  ctx: ActiveContext,
  lotId: string,
  now: Date = new Date(),
): Promise<OwnerCharge[]> {
  if (!(await ownsLot(ctx, lotId))) return [];
  const scoped = forResidence(ctx.residenceId);
  const calls = await scoped.chargeCall.findMany({
    where: { lotId, voidedAt: null },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    select: { id: true, periodYear: true, periodMonth: true, dueDate: true, amountMinor: true },
  });
  const callIds = calls.map((c) => c.id);
  const allocs = callIds.length
    ? await scoped.paymentAllocation.findMany({
        where: { chargeCallId: { in: callIds } },
        select: { chargeCallId: true, amountMinor: true },
      })
    : [];
  const byCall = new Map<string, number>();
  for (const a of allocs)
    byCall.set(a.chargeCallId, (byCall.get(a.chargeCallId) ?? 0) + a.amountMinor);

  return calls.map((c) => {
    const alloc = Math.max(0, byCall.get(c.id) ?? 0);
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
  });
}

/**
 * Indicateur collectif (transparence) : sur la campagne EN COURS (dernière période
 * appelée), combien de lots sont à jour vs en attente. NOMBRES seulement — aucune
 * identité. Scopé à la résidence active.
 */
export async function getResidenceCollectionCounts(ctx: ActiveContext): Promise<CollectionCounts> {
  const scoped = forResidence(ctx.residenceId);
  const latest = await scoped.chargeCall.findFirst({
    where: { voidedAt: null },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    select: { periodYear: true, periodMonth: true },
  });
  if (!latest) return { paidCount: 0, pendingCount: 0, totalLots: 0, period: null };

  const calls = await scoped.chargeCall.findMany({
    where: { periodYear: latest.periodYear, periodMonth: latest.periodMonth, voidedAt: null },
    select: { id: true, amountMinor: true },
  });
  const allocs = calls.length
    ? await scoped.paymentAllocation.findMany({
        where: { chargeCallId: { in: calls.map((c) => c.id) } },
        select: { chargeCallId: true, amountMinor: true },
      })
    : [];
  const byCall = new Map<string, number>();
  for (const a of allocs)
    byCall.set(a.chargeCallId, (byCall.get(a.chargeCallId) ?? 0) + a.amountMinor);

  const counts = countSettledLots(
    calls.map((c) => ({ amountMinor: c.amountMinor, allocatedMinor: byCall.get(c.id) ?? 0 })),
  );
  return { ...counts, period: { year: latest.periodYear, month: latest.periodMonth } };
}

// ── G2 : paiements, reçus, relevé (vue propriétaire, sans accès Person) ───────

export interface OwnerPayment {
  id: string;
  method: string;
  amountMinor: number;
  receivedAt: string;
  isReversal: boolean;
  reversed: boolean;
  receiptId: string | null;
  receiptNumber: string | null;
  receiptVoided: boolean;
}

/**
 * Paiements d'UN lot du propriétaire, plus récent d'abord, avec le n° de reçu (pour la
 * réimpression). Détention vérifiée. Aucun nom d'enregistreur (couche staff) : le
 * propriétaire n'en a pas besoin, et le résoudre lèverait pour un non-staff.
 */
export async function getOwnerLotPayments(
  ctx: ActiveContext,
  lotId: string,
): Promise<OwnerPayment[]> {
  if (!(await ownsLot(ctx, lotId))) return [];
  const scoped = forResidence(ctx.residenceId);
  const payments = await scoped.payment.findMany({
    where: { lotId },
    orderBy: { receivedAt: 'desc' },
    select: {
      id: true,
      method: true,
      amountMinor: true,
      receivedAt: true,
      reversesPaymentId: true,
    },
  });
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
  return payments.map((p) => {
    const rec = receiptByPayment.get(p.id);
    return {
      id: p.id,
      method: p.method,
      amountMinor: p.amountMinor,
      receivedAt: p.receivedAt.toISOString(),
      isReversal: p.reversesPaymentId != null,
      reversed: reversedSet.has(p.id),
      receiptId: rec?.id ?? null,
      receiptNumber: rec?.number ?? null,
      receiptVoided: rec ? rec.voidedAt != null : false,
    };
  });
}

/**
 * Relevé de compte d'UN lot du propriétaire (B4), de SON point de vue. Réutilise le cœur
 * pur `buildLedger`. Détention vérifiée ; aucun accès Person (le nom du propriétaire est
 * ajouté côté page à partir de la session, pas résolu par la couche staff).
 */
export async function getOwnerLotAccount(
  ctx: ActiveContext,
  lotId: string,
): Promise<LotAccount | null> {
  if (!(await ownsLot(ctx, lotId))) return null;
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

  const ledger = buildLedger(calls, payments, receiptByPayment, lateFees);
  return {
    lotReference: lot.reference,
    ownerName: null, // ajouté côté page depuis la session (jamais via la couche staff)
    residence: { name: residence.name, orgName: mandate?.organization?.name ?? null },
    ...ledger,
  };
}

/**
 * Reçu du propriétaire pour réimpression — VÉRIFIE que le reçu porte sur un lot qu'il
 * détient (un propriétaire ne réimprime jamais le reçu d'un voisin). Aucun nom résolu
 * via la couche staff (payeur/enregistreur laissés nuls ; le document dégrade proprement).
 */
export async function getOwnerReceipt(
  ctx: ActiveContext,
  receiptId: string,
): Promise<ReceiptView | null> {
  const scoped = forResidence(ctx.residenceId);
  const receipt = await scoped.receipt.findUnique({
    where: { id: receiptId },
    select: {
      id: true,
      number: true,
      issuedAt: true,
      voidedAt: true,
      amountMinor: true,
      paymentId: true,
      lotId: true,
    },
  });
  if (!receipt) return null;
  // Étanchéité : le reçu doit porter sur un lot DÉTENU par ce propriétaire.
  if (!receipt.lotId || !(await ownsLot(ctx, receipt.lotId))) return null;

  const [payment, allocations, lot, residence, mandate] = await Promise.all([
    scoped.payment.findUnique({
      where: { id: receipt.paymentId },
      select: { method: true, receivedAt: true, reference: true, note: true },
    }),
    scoped.paymentAllocation.findMany({
      where: { paymentId: receipt.paymentId },
      select: { chargeCall: { select: { periodYear: true, periodMonth: true } } },
    }),
    scoped.lot.findUnique({ where: { id: receipt.lotId }, select: { reference: true } }),
    getBaseClient().residence.findUnique({
      where: { id: ctx.residenceId },
      select: { name: true, address: true, city: true },
    }),
    scoped.mandate.findFirst({
      where: { status: 'ACTIVE' },
      select: { organization: { select: { name: true } } },
    }),
  ]);
  if (!payment || !residence) return null;

  const periods = allocations
    .map((a) => ({ year: a.chargeCall.periodYear, month: a.chargeCall.periodMonth }))
    .sort((a, b) => a.year - b.year || a.month - b.month);

  return {
    id: receipt.id,
    number: receipt.number,
    issuedAt: receipt.issuedAt.toISOString(),
    voidedAt: receipt.voidedAt ? receipt.voidedAt.toISOString() : null,
    amountMinor: receipt.amountMinor,
    method: payment.method,
    receivedAt: payment.receivedAt.toISOString(),
    reference: payment.reference,
    note: payment.note,
    payerName: null,
    lotReference: lot?.reference ?? null,
    recordedByName: null,
    periods,
    residence: {
      name: residence.name,
      address: residence.address,
      city: residence.city,
      orgName: mandate?.organization?.name ?? null,
    },
  };
}

/**
 * Reçu (non annulé) du paiement le plus récent alloué à un appel de charges D'UN lot du
 * propriétaire — pour lui offrir un lien direct vers son reçu après paiement. Vérifie la
 * détention du lot (sinon `null`). Aucun accès au modèle Person.
 */
export async function getOwnerReceiptIdForCharge(
  ctx: ActiveContext,
  chargeCallId: string,
): Promise<string | null> {
  const scoped = forResidence(ctx.residenceId);
  const call = await scoped.chargeCall.findUnique({
    where: { id: chargeCallId },
    select: { lotId: true },
  });
  if (!call || !(await ownsLot(ctx, call.lotId))) return null;
  const alloc = await scoped.paymentAllocation.findFirst({
    where: { chargeCallId },
    orderBy: { createdAt: 'desc' },
    select: { paymentId: true },
  });
  if (!alloc) return null;
  const receipt = await scoped.receipt.findFirst({
    where: { paymentId: alloc.paymentId, voidedAt: null },
    select: { id: true },
  });
  return receipt?.id ?? null;
}
