/**
 * Budget prévisionnel + suivi budget/réalisé (I2). Un montant VOTÉ par catégorie et par
 * exercice (`BudgetLine`), comparé au RÉEL des dépenses COURANTES de l'exercice (jamais le
 * fonds travaux — exclu par défaut de `listExpenses`). L'écart = budget − réalisé.
 */
import { forResidence } from '@/server/db/tenant';
import type { ActiveContext } from '@/server/auth/context';
import { listExpenses, aggregateByCategory } from './expenses';

export interface BudgetActualLine {
  categoryId: string | null;
  label: string;
  budgetedMinor: number;
  realizedMinor: number;
  ecartMinor: number; // budget − réalisé (positif = sous le budget)
}
export interface BudgetVsActual {
  exercice: number;
  lines: BudgetActualLine[];
  totalBudgetedMinor: number;
  totalRealizedMinor: number;
  totalEcartMinor: number;
}

export interface BudgetedInput {
  categoryId: string | null;
  label: string;
  budgetedMinor: number;
}
export interface RealizedInput {
  categoryId: string | null;
  label: string;
  totalMinor: number;
}

/**
 * Fusionne le budget voté et le réalisé par catégorie (fonction PURE). Une catégorie
 * apparaît si elle est budgétée OU réalisée (jamais les deux à zéro implicitement). L'écart
 * = budget − réalisé (positif = sous le budget). Trié par budget décroissant, puis libellé.
 */
export function computeBudgetVsActual(
  exercice: number,
  budgeted: readonly BudgetedInput[],
  realized: readonly RealizedInput[],
): BudgetVsActual {
  const map = new Map<string | null, BudgetActualLine>();
  for (const b of budgeted) {
    map.set(b.categoryId, {
      categoryId: b.categoryId,
      label: b.label,
      budgetedMinor: b.budgetedMinor,
      realizedMinor: 0,
      ecartMinor: 0,
    });
  }
  for (const r of realized) {
    const existing = map.get(r.categoryId);
    if (existing) existing.realizedMinor = r.totalMinor;
    else
      map.set(r.categoryId, {
        categoryId: r.categoryId,
        label: r.label,
        budgetedMinor: 0,
        realizedMinor: r.totalMinor,
        ecartMinor: 0,
      });
  }
  const lines = [...map.values()]
    .map((l) => ({ ...l, ecartMinor: l.budgetedMinor - l.realizedMinor }))
    .sort((a, b) => b.budgetedMinor - a.budgetedMinor || a.label.localeCompare(b.label));

  return {
    exercice,
    lines,
    totalBudgetedMinor: lines.reduce((s, l) => s + l.budgetedMinor, 0),
    totalRealizedMinor: lines.reduce((s, l) => s + l.realizedMinor, 0),
    totalEcartMinor: lines.reduce((s, l) => s + l.ecartMinor, 0),
  };
}

/** Budget prévisionnel vs réalisé d'un exercice. `includeInternal` : le staff voit tout le réel. */
export async function getBudgetVsActual(
  ctx: ActiveContext,
  exercice: number,
  uncategorizedLabel: string,
  includeInternal: boolean,
): Promise<BudgetVsActual> {
  const scoped = forResidence(ctx.residenceId);
  const from = new Date(Date.UTC(exercice, 0, 1));
  const to = new Date(Date.UTC(exercice, 11, 31, 23, 59, 59));

  const [budgetLines, expenseList] = await Promise.all([
    scoped.budgetLine.findMany({
      where: { exercice },
      select: { categoryId: true, amountMinor: true, category: { select: { label: true } } },
    }),
    // `worksFund` par défaut à 'exclude' : le réalisé COURANT, jamais le fonds travaux.
    listExpenses(ctx, { includeInternal, from, to }),
  ]);
  const realized = aggregateByCategory(
    expenseList.rows.filter((e) => !e.isReversal && !e.reversed),
    uncategorizedLabel,
  );

  return computeBudgetVsActual(
    exercice,
    budgetLines.map((b) => ({
      categoryId: b.categoryId,
      label: b.category.label,
      budgetedMinor: b.amountMinor,
    })),
    realized.rows.map((r) => ({ categoryId: r.categoryId, label: r.label, totalMinor: r.totalMinor })),
  );
}

export interface CategoryBudget {
  id: string;
  label: string;
  budgetedMinor: number;
}

/** Catégories actives + leur montant budgété pour l'exercice (pour l'éditeur syndic). */
export async function listCategoriesWithBudget(
  ctx: ActiveContext,
  exercice: number,
): Promise<CategoryBudget[]> {
  const scoped = forResidence(ctx.residenceId);
  const [cats, lines] = await Promise.all([
    scoped.expenseCategory.findMany({
      where: { archivedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true },
    }),
    scoped.budgetLine.findMany({ where: { exercice }, select: { categoryId: true, amountMinor: true } }),
  ]);
  const byCategory = new Map(lines.map((l) => [l.categoryId, l.amountMinor]));
  return cats.map((c) => ({ id: c.id, label: c.label, budgetedMinor: byCategory.get(c.id) ?? 0 }));
}
