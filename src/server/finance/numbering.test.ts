import { describe, it, expect } from 'vitest';
import {
  NUMBER_SEQUENCE_UPSERT_SQL,
  formatReceiptNumber,
  formatVoucherNumber,
  type NumberSeries,
} from './numbering';
import { freshDb, insertResidence, insertPayment } from '@/test/pglite';
import type { PGlite } from '@electric-sql/pglite';

// Runs the exact allocation SQL used by the (private) allocator.
async function alloc(
  db: { query: PGlite['query'] },
  residenceId: string,
  exercice: number,
  series: NumberSeries,
): Promise<number> {
  const res = await db.query<{ lastValue: number }>(NUMBER_SEQUENCE_UPSERT_SQL, [
    residenceId,
    exercice,
    series,
  ]);
  return res.rows[0]!.lastValue;
}

describe('receipt/voucher sequence (real Postgres via PGlite)', () => {
  it('is continuous and gapless per (residence, exercice, series)', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    const got: number[] = [];
    for (let i = 0; i < 5; i++) got.push(await alloc(db, 'r1', 2026, 'RECU'));
    expect(got).toEqual([1, 2, 3, 4, 5]);
  });

  it('a ROLLBACK does not consume a number (atomicity of createReceipt)', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    expect(await alloc(db, 'r1', 2026, 'RECU')).toBe(1);
    // Simulate createReceipt's transaction failing AFTER allocation.
    await expect(
      db.transaction(async (tx) => {
        await alloc(tx, 'r1', 2026, 'RECU'); // would be 2
        throw new Error('receipt insert failed');
      }),
    ).rejects.toThrow();
    // The rolled-back allocation must NOT have been consumed: next value is 2, not 3.
    expect(await alloc(db, 'r1', 2026, 'RECU')).toBe(2);
  });

  it('separates series, exercices and residences', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await insertResidence(db, 'r2');
    expect(await alloc(db, 'r1', 2026, 'RECU')).toBe(1);
    expect(await alloc(db, 'r1', 2026, 'JUSTIFICATIF')).toBe(1);
    expect(await alloc(db, 'r1', 2027, 'RECU')).toBe(1);
    expect(await alloc(db, 'r2', 2026, 'RECU')).toBe(1);
    expect(await alloc(db, 'r1', 2026, 'RECU')).toBe(2);
  });

  it('DB rejects a duplicate receipt sequence number', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await insertPayment(db, 'p1', 'r1', 65000);
    await insertPayment(db, 'p2', 'r1', 65000);
    const insertReceipt = (id: string, paymentId: string, seq: number) =>
      db.query(
        'INSERT INTO "Receipt"(id, "residenceId", exercice, sequence, number, "paymentId", "amountMinor") VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, 'r1', 2026, seq, formatReceiptNumber(2026, seq), paymentId, 65000],
      );
    await insertReceipt('rec1', 'p1', 1);
    await expect(insertReceipt('rec2', 'p2', 1)).rejects.toThrow();
  });

  it('formats numbers with zero-padding', () => {
    expect(formatReceiptNumber(2026, 1)).toBe('REC-2026-0001');
    expect(formatVoucherNumber(2026, 42)).toBe('DEP-2026-0042');
  });
});
