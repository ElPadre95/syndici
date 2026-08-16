/**
 * Régularisation annuelle (I3). En fin d'exercice, on confronte les PROVISIONS appelées de
 * l'année (somme des appels de charges) à la QUOTE-PART RÉELLE des dépenses courantes de la
 * copropriété (le total réparti aux tantièmes, au centime près). L'écart par lot devient un
 * **supplément** à appeler (positif, débite le compte) ou un **avoir** (négatif, le crédite).
 *
 * La régularisation n'est PAS obligatoire : le syndic la déclenche quand il veut clôturer un
 * exercice. Elle est IDEMPOTENTE (au plus une active par exercice — index partiel) et
 * RÉVERSIBLE par annulation douce (`voidedAt`), comme un appel de charges. Le cœur du calcul
 * est PUR (`computeRegularisation`), donc testable sans base.
 */
import { forResidence } from '@/server/db/tenant';
import type { ActiveContext } from '@/server/auth/context';
import { distributeByTantiemes } from './campaigns';

export interface RegularisationLotInput {
  lotId: string;
  reference: string;
  quotePart: number;
  provisionsMinor: number; // appels de l'exercice pour ce lot
}
export interface RegularisationLine {
  lotId: string;
  reference: string;
  quotePart: number;
  provisionsMinor: number;
  quotePartMinor: number; // part réelle des dépenses (répartie aux tantièmes)
  adjustmentMinor: number; // quote-part − provisions (positif = supplément, négatif = avoir)
}
export interface RegularisationPlan {
  exercice: number;
  totalExpensesMinor: number;
  totalProvisionsMinor: number;
  totalAdjustmentMinor: number; // = totalExpenses − totalProvisions (invariant)
  lines: RegularisationLine[];
}

/**
 * Cœur PUR. Répartit `totalExpensesMinor` aux tantièmes (somme EXACTE, plus fort reste), puis
 * calcule pour chaque lot l'écart quote-part − provisions. Trié par référence de lot (numérique).
 */
export function computeRegularisation(
  exercice: number,
  totalExpensesMinor: number,
  lots: readonly RegularisationLotInput[],
): RegularisationPlan {
  const share = distributeByTantiemes(
    Math.max(0, totalExpensesMinor),
    lots.map((l) => ({ id: l.lotId, quotePart: l.quotePart })),
  );
  const lines: RegularisationLine[] = lots
    .map((l) => {
      const quotePartMinor = share.get(l.lotId) ?? 0;
      return {
        lotId: l.lotId,
        reference: l.reference,
        quotePart: l.quotePart,
        provisionsMinor: l.provisionsMinor,
        quotePartMinor,
        adjustmentMinor: quotePartMinor - l.provisionsMinor,
      };
    })
    .sort((a, b) => a.reference.localeCompare(b.reference, undefined, { numeric: true }));

  return {
    exercice,
    totalExpensesMinor: Math.max(0, totalExpensesMinor),
    totalProvisionsMinor: lots.reduce((s, l) => s + l.provisionsMinor, 0),
    totalAdjustmentMinor: lines.reduce((s, l) => s + l.adjustmentMinor, 0),
    lines,
  };
}

/** Bornes UTC d'un exercice (année civile). */
function exerciceRange(exercice: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(exercice, 0, 1)),
    to: new Date(Date.UTC(exercice, 11, 31, 23, 59, 59)),
  };
}

/**
 * Prévisualise la régularisation d'un exercice à partir des données réelles : dépenses
 * COURANTES nettes (jamais le fonds travaux) et provisions appelées par lot (appels non
 * annulés de l'année). Aucune écriture — c'est ce que le syndic voit avant de valider.
 */
export async function previewRegularisation(
  ctx: ActiveContext,
  exercice: number,
): Promise<RegularisationPlan> {
  const scoped = forResidence(ctx.residenceId);
  const { from, to } = exerciceRange(exercice);
  const [lots, expenses, provisions] = await Promise.all([
    scoped.lot.findMany({
      where: { archivedAt: null },
      select: { id: true, reference: true, quotePart: true },
    }),
    scoped.expense.aggregate({
      _sum: { amountMinor: true },
      // Dépenses courantes de l'exercice (net des annulations) — le fonds travaux est exclu.
      where: { onWorksFund: false, spentOn: { gte: from, lte: to } },
    }),
    scoped.chargeCall.groupBy({
      by: ['lotId'],
      where: { periodYear: exercice, voidedAt: null },
      _sum: { amountMinor: true },
    }),
  ]);
  const provisionsByLot = new Map(provisions.map((p) => [p.lotId, p._sum.amountMinor ?? 0]));
  const inputs: RegularisationLotInput[] = lots.map((l) => ({
    lotId: l.id,
    reference: l.reference,
    quotePart: l.quotePart,
    provisionsMinor: provisionsByLot.get(l.id) ?? 0,
  }));
  return computeRegularisation(exercice, expenses._sum.amountMinor ?? 0, inputs);
}

export interface CommittedRegularisation extends RegularisationPlan {
  id: string;
  effectiveOn: string;
  createdAt: string;
}

/** La régularisation ACTIVE (non annulée) d'un exercice, ou `null`. */
export async function getRegularisation(
  ctx: ActiveContext,
  exercice: number,
): Promise<CommittedRegularisation | null> {
  const scoped = forResidence(ctx.residenceId);
  const reg = await scoped.regularisation.findFirst({
    where: { exercice, voidedAt: null },
    select: {
      id: true,
      exercice: true,
      effectiveOn: true,
      createdAt: true,
      totalExpensesMinor: true,
      totalProvisionsMinor: true,
      lines: {
        select: {
          lotId: true,
          provisionsMinor: true,
          quotePartMinor: true,
          adjustmentMinor: true,
          lot: { select: { reference: true, quotePart: true } },
        },
      },
    },
  });
  if (!reg) return null;
  const lines: RegularisationLine[] = reg.lines
    .map((l) => ({
      lotId: l.lotId,
      reference: l.lot.reference,
      quotePart: l.lot.quotePart,
      provisionsMinor: l.provisionsMinor,
      quotePartMinor: l.quotePartMinor,
      adjustmentMinor: l.adjustmentMinor,
    }))
    .sort((a, b) => a.reference.localeCompare(b.reference, undefined, { numeric: true }));
  return {
    id: reg.id,
    exercice: reg.exercice,
    effectiveOn: reg.effectiveOn.toISOString(),
    createdAt: reg.createdAt.toISOString(),
    totalExpensesMinor: reg.totalExpensesMinor,
    totalProvisionsMinor: reg.totalProvisionsMinor,
    totalAdjustmentMinor: lines.reduce((s, l) => s + l.adjustmentMinor, 0),
    lines,
  };
}

/**
 * Écritures de régularisation d'un lot (pour son grand livre) : seules les lignes des
 * régularisations ACTIVES, à écart non nul. Type minimal aligné sur `LedgerRegularisation`.
 */
export async function fetchLotRegularisations(
  scoped: ReturnType<typeof forResidence>,
  lotId: string,
): Promise<{ effectiveOn: Date; exercice: number; adjustmentMinor: number }[]> {
  const lines = await scoped.regularisationLine.findMany({
    where: { lotId, regularisation: { is: { voidedAt: null } } },
    select: {
      adjustmentMinor: true,
      regularisation: { select: { effectiveOn: true, exercice: true } },
    },
  });
  return lines
    .filter((l) => l.adjustmentMinor !== 0)
    .map((l) => ({
      effectiveOn: l.regularisation.effectiveOn,
      exercice: l.regularisation.exercice,
      adjustmentMinor: l.adjustmentMinor,
    }));
}
