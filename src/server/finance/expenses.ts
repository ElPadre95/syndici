/**
 * Dépenses (C1). Saisir une dépense (catégorie, montant en centimes, date, fournisseur,
 * description, justificatif, visibilité copropriétaires/interne) et l'annuler par
 * ÉCRITURE INVERSE (dépense négative liant l'originale) — comme les paiements. Une
 * dépense ne se supprime jamais. Chaque écriture est tracée au journal d'audit.
 *
 * Écriture executor-based (SQL brut typé, cf. §5 bis) → testable PGlite ET Postgres réel.
 * Le numéro de justificatif `DEP-<exercice>-<n>` est CONTINU et SANS TROU (même compteur
 * que les reçus), alloué DANS la transaction.
 */
import { forResidence } from '@/server/db/tenant';
import type { TxRunner } from '@/server/db/sql';
import { NUMBER_SEQUENCE_UPSERT_SQL, formatVoucherNumber } from './numbering';
import type { ActiveContext } from '@/server/auth/context';

export type ExpenseVisibility = 'PARTAGE' | 'INTERNE';
export const EXPENSE_VISIBILITIES: readonly ExpenseVisibility[] = ['PARTAGE', 'INTERNE'];

const INSERT_EXPENSE = `
  INSERT INTO "Expense"
    (id,"residenceId","categoryId",description,"amountMinor","spentOn","supplierName",
     visibility,exercice,"voucherSequence","voucherNumber","justificatifId","reversesExpenseId","createdAt")
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5::date,$6,$7::"ExpenseVisibility",$8,$9,$10,$11,$12,now())
  RETURNING id`;

const INSERT_AUDIT = `
  INSERT INTO "AuditLog" (id,"residenceId","actorPersonId",action,"entityType","entityId",after,at)
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6::jsonb,now())`;

export interface RecordExpenseInput {
  residenceId: string;
  categoryId: string | null;
  description: string;
  amountMinor: number;
  spentOn: Date;
  supplierName: string | null;
  visibility: ExpenseVisibility;
  justificatifId: string | null;
  actorPersonId: string;
}

export interface WriteExpenseResult {
  id: string;
  voucherNumber: string;
}

/** Écrit une dépense (numéro de justificatif + trace d'audit) dans UNE transaction. */
export async function writeExpense(
  runner: TxRunner,
  input: RecordExpenseInput,
): Promise<WriteExpenseResult> {
  return runner.transaction(async (tx) => {
    const exercice = input.spentOn.getUTCFullYear();
    const seq = (
      await tx.query<{ lastValue: number }>(NUMBER_SEQUENCE_UPSERT_SQL, [
        input.residenceId,
        exercice,
        'JUSTIFICATIF',
      ])
    )[0]!.lastValue;
    const voucherNumber = formatVoucherNumber(exercice, seq);

    const id = (
      await tx.query<{ id: string }>(INSERT_EXPENSE, [
        input.residenceId,
        input.categoryId,
        input.description,
        input.amountMinor,
        input.spentOn.toISOString().slice(0, 10),
        input.supplierName,
        input.visibility,
        exercice,
        seq,
        voucherNumber,
        input.justificatifId,
        null, // reversesExpenseId
      ])
    )[0]!.id;

    await tx.query(INSERT_AUDIT, [
      input.residenceId,
      input.actorPersonId,
      'expense.record',
      'Expense',
      id,
      JSON.stringify({
        voucherNumber,
        amountMinor: input.amountMinor,
        visibility: input.visibility,
      }),
    ]);
    return { id, voucherNumber };
  });
}

export type ReverseExpenseResult =
  | { ok: true; reversalId: string }
  | { ok: false; reason: 'not_found' | 'already_reversed' | 'is_reversal' };

/**
 * Annule une dépense par ÉCRITURE INVERSE : crée une dépense négative liant l'originale
 * (le total net redevient correct par somme). L'originale n'est jamais touchée. Refuse
 * d'annuler une dépense déjà annulée ou qui est elle-même une annulation. Le justificatif
 * n'est PAS recopié (l'annulation n'en porte pas) ; aucun nouveau numéro n'est consommé.
 */
export async function reverseExpense(
  runner: TxRunner,
  params: {
    residenceId: string;
    expenseId: string;
    reason: string;
    actorPersonId: string;
    now?: Date;
  },
): Promise<ReverseExpenseResult> {
  const now = params.now ?? new Date();
  return runner.transaction(async (tx) => {
    const orig = (
      await tx.query<{
        id: string;
        categoryId: string | null;
        description: string;
        amountMinor: number;
        supplierName: string | null;
        visibility: string;
        reversesExpenseId: string | null;
      }>(
        `SELECT id,"categoryId",description,"amountMinor","supplierName",visibility,"reversesExpenseId"
           FROM "Expense" WHERE id = $1 AND "residenceId" = $2 FOR UPDATE`,
        [params.expenseId, params.residenceId],
      )
    )[0];
    if (!orig) return { ok: false as const, reason: 'not_found' as const };
    if (orig.reversesExpenseId) return { ok: false as const, reason: 'is_reversal' as const };
    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM "Expense" WHERE "reversesExpenseId" = $1 LIMIT 1`,
      [params.expenseId],
    );
    if (existing[0]) return { ok: false as const, reason: 'already_reversed' as const };

    const reversalId = (
      await tx.query<{ id: string }>(INSERT_EXPENSE, [
        params.residenceId,
        orig.categoryId,
        orig.description,
        -orig.amountMinor,
        now.toISOString().slice(0, 10),
        orig.supplierName,
        orig.visibility,
        null, // exercice — pas de numéro pour une annulation
        null, // voucherSequence
        null, // voucherNumber
        null, // justificatifId
        orig.id, // reversesExpenseId
      ])
    )[0]!.id;

    await tx.query(INSERT_AUDIT, [
      params.residenceId,
      params.actorPersonId,
      'expense.reverse',
      'Expense',
      reversalId,
      JSON.stringify({ reverses: orig.id, amountMinor: -orig.amountMinor, reason: params.reason }),
    ]);
    return { ok: true as const, reversalId };
  });
}

// ── Lectures ─────────────────────────────────────────────────────────────────

export interface ExpenseCategoryOption {
  id: string;
  label: string;
}

/** Catégories actives de la résidence (pour le formulaire et les filtres). */
export async function getExpenseCategories(ctx: ActiveContext): Promise<ExpenseCategoryOption[]> {
  const scoped = forResidence(ctx.residenceId);
  const cats = await scoped.expenseCategory.findMany({
    where: { archivedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, label: true },
  });
  return cats;
}

export interface ExpenseRow {
  id: string;
  spentOn: string;
  categoryLabel: string | null;
  supplierName: string | null;
  description: string;
  amountMinor: number;
  visibility: ExpenseVisibility;
  voucherNumber: string | null;
  justificatifId: string | null;
  isReversal: boolean;
  reversed: boolean;
}

export interface ExpenseList {
  rows: ExpenseRow[];
  totalNetMinor: number; // somme signée (annulations comprises)
}

/**
 * Dépenses de la résidence, la plus récente d'abord. `includeInternal=false` masque les
 * dépenses INTERNE (vue copropriétaire) ; le staff voit tout.
 */
export async function listExpenses(
  ctx: ActiveContext,
  opts: { includeInternal: boolean } = { includeInternal: true },
): Promise<ExpenseList> {
  const scoped = forResidence(ctx.residenceId);
  const expenses = await scoped.expense.findMany({
    where: opts.includeInternal ? {} : { visibility: 'PARTAGE' },
    orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      spentOn: true,
      supplierName: true,
      description: true,
      amountMinor: true,
      visibility: true,
      voucherNumber: true,
      justificatifId: true,
      reversesExpenseId: true,
      category: { select: { label: true } },
    },
  });
  const reversedSet = new Set(
    expenses.filter((e) => e.reversesExpenseId).map((e) => e.reversesExpenseId as string),
  );

  const rows: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    spentOn: e.spentOn.toISOString(),
    categoryLabel: e.category?.label ?? null,
    supplierName: e.supplierName,
    description: e.description,
    amountMinor: e.amountMinor,
    visibility: e.visibility as ExpenseVisibility,
    voucherNumber: e.voucherNumber,
    justificatifId: e.justificatifId,
    isReversal: e.reversesExpenseId != null,
    reversed: reversedSet.has(e.id),
  }));

  return { rows, totalNetMinor: rows.reduce((s, r) => s + r.amountMinor, 0) };
}
