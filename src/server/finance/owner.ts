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
import type { ActiveContext } from '@/server/auth/context';
import {
  deriveSettlementState,
  deriveTemporalState,
  daysLate,
  remainingDueMinor,
  type SettlementState,
  type TemporalState,
} from './status';

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
