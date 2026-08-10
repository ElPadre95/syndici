/**
 * Numérotation séquentielle des reçus et justificatifs — contrainte comptable :
 * séquence CONTINUE, SANS TROU, par (résidence, exercice, série) (SPEC §7.7, decision D20,
 * correction étape 4a).
 *
 * Impossible à mal utiliser :
 *   - l'allocateur `allocateNumber` est PRIVÉ (non exporté) et n'accepte QU'un
 *     `Prisma.TransactionClient` — jamais le client de base ;
 *   - la seule API publique est `createReceipt()` / `createExpense()`, qui ouvrent
 *     elles-mêmes la transaction englobant l'allocation ET l'écriture.
 * Un rollback (échec de l'écriture) annule donc l'incrément du compteur : aucun
 * numéro n'est consommé (test dédié). Le SQL d'allocation est exporté (constante)
 * pour être testé tel quel contre un vrai Postgres.
 */
import { Prisma, type Receipt, type Expense } from '@prisma/client';
import { getBaseClient } from '@/server/db/client';

export type NumberSeries = 'RECU' | 'JUSTIFICATIF';

/** UPSERT atomique : incrémente et renvoie `lastValue` pour (résidence, exercice, série). */
export const NUMBER_SEQUENCE_UPSERT_SQL = `
  INSERT INTO "NumberSequence" ("residenceId", "exercice", "series", "lastValue")
  VALUES ($1, $2, $3::"NumberSeries", 1)
  ON CONFLICT ("residenceId", "exercice", "series")
  DO UPDATE SET "lastValue" = "NumberSequence"."lastValue" + 1
  RETURNING "lastValue";`;

/**
 * PRIVÉ. Réserve le prochain numéro. N'accepte qu'un client transactionnel : l'appel
 * DOIT se faire dans la même transaction que l'écriture du reçu/justificatif.
 */
async function allocateNumber(
  tx: Prisma.TransactionClient,
  residenceId: string,
  exercice: number,
  series: NumberSeries,
): Promise<number> {
  const rows = await tx.$queryRawUnsafe<Array<{ lastValue: number }>>(
    NUMBER_SEQUENCE_UPSERT_SQL,
    residenceId,
    exercice,
    series,
  );
  const value = rows[0]?.lastValue;
  if (typeof value !== 'number') {
    throw new Error('Sequence allocation failed to return a numeric value.');
  }
  return value;
}

const PAD = 4;

export function formatReceiptNumber(exercice: number, sequence: number): string {
  return `REC-${exercice}-${String(sequence).padStart(PAD, '0')}`;
}

export function formatVoucherNumber(exercice: number, sequence: number): string {
  return `DEP-${exercice}-${String(sequence).padStart(PAD, '0')}`;
}

export interface CreateReceiptInput {
  residenceId: string;
  exercice: number;
  paymentId: string;
  amountMinor: number;
  lotId?: string | null;
}

/**
 * Crée un reçu avec un numéro séquentiel, dans UNE transaction (allocation + insertion).
 * Seul moyen d'émettre un reçu.
 */
export async function createReceipt(input: CreateReceiptInput): Promise<Receipt> {
  const prisma = getBaseClient();
  return prisma.$transaction(async (tx) => {
    const seq = await allocateNumber(tx, input.residenceId, input.exercice, 'RECU');
    return tx.receipt.create({
      data: {
        residenceId: input.residenceId,
        exercice: input.exercice,
        sequence: seq,
        number: formatReceiptNumber(input.exercice, seq),
        paymentId: input.paymentId,
        lotId: input.lotId ?? null,
        amountMinor: input.amountMinor,
      },
    });
  });
}

export interface CreateExpenseInput {
  residenceId: string;
  exercice: number;
  description: string;
  amountMinor: number;
  spentOn: Date;
  categoryId?: string | null;
  supplierName?: string | null;
  justificatifId?: string | null;
}

/** Crée une dépense avec un numéro de justificatif séquentiel, dans UNE transaction. */
export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const prisma = getBaseClient();
  return prisma.$transaction(async (tx) => {
    const seq = await allocateNumber(tx, input.residenceId, input.exercice, 'JUSTIFICATIF');
    return tx.expense.create({
      data: {
        residenceId: input.residenceId,
        categoryId: input.categoryId ?? null,
        description: input.description,
        amountMinor: input.amountMinor,
        spentOn: input.spentOn,
        supplierName: input.supplierName ?? null,
        exercice: input.exercice,
        voucherSequence: seq,
        voucherNumber: formatVoucherNumber(input.exercice, seq),
        justificatifId: input.justificatifId ?? null,
      },
    });
  });
}
