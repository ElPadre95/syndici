/**
 * Bilan annuel (H3) — état comptable d'exercice pour une résidence, à distribuer en
 * assemblée. COMPOSITION de lectures existantes, aucune logique nouvelle : appelé /
 * encaissé / dépensé de l'exercice, reste dû et trésorerie à ce jour, dépenses par
 * catégorie, contrats, et la situation lot par lot. Ce n'est PAS un procès-verbal : aucune
 * valeur légale, un état comptable.
 */
import { forResidence } from '@/server/db/tenant';
import { getBaseClient } from '@/server/db/client';
import type { ActiveContext } from '@/server/auth/context';
import { getTreasury } from './treasury';
import { listExpenses, aggregateByCategory } from './expenses';
import { listContracts, type ContractView } from './contracts';

export interface AnnualCategoryRow {
  label: string;
  totalMinor: number;
}
export interface AnnualLotRow {
  reference: string;
  calledMinor: number;
  paidMinor: number;
  lateFeeMinor: number;
  remainingMinor: number;
}
export interface AnnualReport {
  exercice: number;
  residence: { name: string; city: string | null; orgName: string | null };
  calledMinor: number; // appelé (exercice)
  collectedMinor: number; // encaissé (exercice)
  spentMinor: number; // dépensé (exercice)
  lateFeeMinor: number; // frais de retard (exercice)
  outstandingMinor: number; // reste dû à ce jour (tous lots)
  treasuryMinor: number; // solde de trésorerie à ce jour
  categories: AnnualCategoryRow[];
  contracts: ContractView[];
  lots: AnnualLotRow[];
}

/** Bilan d'exercice. `uncategorizedLabel` sert au regroupement des dépenses sans catégorie. */
export async function getAnnualReport(
  ctx: ActiveContext,
  exercice: number,
  uncategorizedLabel: string,
): Promise<AnnualReport | null> {
  const scoped = forResidence(ctx.residenceId);
  const from = new Date(Date.UTC(exercice, 0, 1));
  const to = new Date(Date.UTC(exercice, 11, 31, 23, 59, 59));

  const [residence, mandate, calledAgg, feeAgg, yearTreasury, allTime, expenses, contracts, lots] =
    await Promise.all([
      getBaseClient().residence.findUnique({
        where: { id: ctx.residenceId },
        select: { name: true, city: true, reportedBalanceMinor: true },
      }),
      scoped.mandate.findFirst({
        where: { status: 'ACTIVE' },
        select: { organization: { select: { name: true } } },
      }),
      scoped.chargeCall.aggregate({
        _sum: { amountMinor: true },
        where: { voidedAt: null, periodYear: exercice },
      }),
      scoped.lateFee.aggregate({
        _sum: { amountMinor: true },
        where: { appliedAt: { gte: from, lte: to } },
      }),
      getTreasury(ctx, { from, to }),
      getTreasury(ctx),
      listExpenses(ctx, { includeInternal: true }), // bilan = fait comptable (interne compris)
      listContracts(ctx),
      scoped.lot.findMany({ where: { archivedAt: null }, select: { id: true, reference: true } }),
    ]);
  if (!residence) return null;

  // Dépenses de l'EXERCICE, par catégorie.
  const yearExpenses = expenses.rows.filter(
    (e) => !e.isReversal && !e.reversed && new Date(e.spentOn).getUTCFullYear() === exercice,
  );
  const byCategory = aggregateByCategory(yearExpenses, uncategorizedLabel);

  // Situation par lot À CE JOUR : appelé + frais − réglé (comme le solde du relevé).
  const [callByLot, payByLot, feeByLot] = await Promise.all([
    scoped.chargeCall.groupBy({ by: ['lotId'], _sum: { amountMinor: true }, where: { voidedAt: null } }),
    scoped.payment.groupBy({ by: ['lotId'], _sum: { amountMinor: true } }),
    scoped.lateFee.groupBy({ by: ['lotId'], _sum: { amountMinor: true } }),
  ]);
  const called = new Map(callByLot.map((r) => [r.lotId, r._sum.amountMinor ?? 0]));
  const paid = new Map(payByLot.map((r) => [r.lotId, r._sum.amountMinor ?? 0]));
  const fees = new Map(feeByLot.map((r) => [r.lotId, r._sum.amountMinor ?? 0]));

  const lotRows: AnnualLotRow[] = lots
    .map((l) => {
      const c = called.get(l.id) ?? 0;
      const p = paid.get(l.id) ?? 0;
      const f = fees.get(l.id) ?? 0;
      return { reference: l.reference, calledMinor: c, paidMinor: p, lateFeeMinor: f, remainingMinor: c + f - p };
    })
    .sort((a, b) => a.reference.localeCompare(b.reference, undefined, { numeric: true }));

  const outstandingMinor = lotRows.reduce((s, r) => s + Math.max(0, r.remainingMinor), 0);
  const treasuryMinor = residence.reportedBalanceMinor + allTime.netMinor;

  return {
    exercice,
    residence: { name: residence.name, city: residence.city, orgName: mandate?.organization?.name ?? null },
    calledMinor: calledAgg._sum.amountMinor ?? 0,
    collectedMinor: yearTreasury.collectedMinor,
    spentMinor: yearTreasury.spentMinor,
    lateFeeMinor: feeAgg._sum.amountMinor ?? 0,
    outstandingMinor,
    treasuryMinor,
    categories: byCategory.rows.map((r) => ({ label: r.label, totalMinor: r.totalMinor })),
    contracts,
    lots: lotRows,
  };
}
