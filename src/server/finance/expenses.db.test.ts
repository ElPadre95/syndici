/**
 * Dépenses (C1) — invariants au niveau base. PGlite (gate) ET Postgres réel
 * (`npm run test:pg`). Prouve : numéro de justificatif DEP-<exercice>-<n> continu,
 * audit de toute écriture, visibilité stockée, annulation par écriture inverse
 * (dépense négative liant l'originale, total net nul), refus d'annuler deux fois /
 * une annulation / une dépense inexistante.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  freshDb,
  pgliteExecutor,
  pgliteTxRunner,
  insertResidence,
  type TestDb,
} from '@/test/pglite';
import type { SqlExecutor, TxRunner } from '@/server/db/sql';
import { writeExpense, reverseExpense, type RecordExpenseInput } from './expenses';

let db: TestDb;
let exec: SqlExecutor;
let runner: TxRunner;
const RES = 'res-1';

beforeEach(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);
  runner = pgliteTxRunner(db);
  await insertResidence(db, RES);
});

const base = (over: Partial<RecordExpenseInput> = {}): RecordExpenseInput => ({
  residenceId: RES,
  categoryId: null,
  description: 'Facture RADEEMA',
  amountMinor: 184000,
  spentOn: new Date('2026-03-10T00:00:00Z'),
  supplierName: 'RADEEMA',
  visibility: 'PARTAGE',
  justificatifId: null,
  actorPersonId: 'actor',
  ...over,
});

async function expenseCount(): Promise<number> {
  return (await exec.query<{ n: number }>('SELECT count(*)::int AS n FROM "Expense"'))[0]!.n;
}
async function auditCount(action: string): Promise<number> {
  return (
    await exec.query<{ n: number }>(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action = $1`, [
      action,
    ])
  )[0]!.n;
}
async function netTotal(): Promise<number> {
  return (
    await exec.query<{ s: number }>(
      `SELECT COALESCE(SUM("amountMinor"),0)::int AS s FROM "Expense"`,
    )
  )[0]!.s;
}

describe('writeExpense', () => {
  it('écrit la dépense, numérote le justificatif, trace l’audit, stocke la visibilité', async () => {
    const res = await writeExpense(runner, base({ visibility: 'INTERNE' }));
    expect(res.voucherNumber).toBe('DEP-2026-0001');
    expect(await expenseCount()).toBe(1);
    expect(await auditCount('expense.record')).toBe(1);
    const row = await exec.query<{ visibility: string; amountMinor: number }>(
      `SELECT visibility, "amountMinor" FROM "Expense" WHERE id = $1`,
      [res.id],
    );
    expect(row[0]).toEqual({ visibility: 'INTERNE', amountMinor: 184000 });
  });

  it('numérote de façon continue par exercice (année de la dépense)', async () => {
    const a = await writeExpense(runner, base());
    const b = await writeExpense(runner, base());
    const c = await writeExpense(runner, base({ spentOn: new Date('2027-01-05T00:00:00Z') }));
    expect(a.voucherNumber).toBe('DEP-2026-0001');
    expect(b.voucherNumber).toBe('DEP-2026-0002');
    expect(c.voucherNumber).toBe('DEP-2027-0001');
  });
});

describe('reverseExpense (annulation par écriture inverse)', () => {
  it('crée une dépense négative liant l’originale ; total net nul ; audit', async () => {
    const { id } = await writeExpense(runner, base({ amountMinor: 184000 }));
    const r = await reverseExpense(runner, {
      residenceId: RES,
      expenseId: id,
      reason: 'Double saisie',
      actorPersonId: 'actor',
    });
    expect(r.ok).toBe(true);
    expect(await expenseCount()).toBe(2); // originale + annulation
    expect(await netTotal()).toBe(0); // 184000 - 184000
    expect(await auditCount('expense.reverse')).toBe(1);

    const rev = await exec.query<{ amountMinor: number; reversesExpenseId: string }>(
      `SELECT "amountMinor","reversesExpenseId" FROM "Expense" WHERE "reversesExpenseId" = $1`,
      [id],
    );
    expect(rev[0]!.amountMinor).toBe(-184000);
    // l'originale est intacte
    const orig = await exec.query<{ amountMinor: number }>(
      `SELECT "amountMinor" FROM "Expense" WHERE id = $1`,
      [id],
    );
    expect(orig[0]!.amountMinor).toBe(184000);
  });

  it('refuse d’annuler une dépense déjà annulée', async () => {
    const { id } = await writeExpense(runner, base());
    await reverseExpense(runner, {
      residenceId: RES,
      expenseId: id,
      reason: 'x',
      actorPersonId: 'a',
    });
    const second = await reverseExpense(runner, {
      residenceId: RES,
      expenseId: id,
      reason: 'x',
      actorPersonId: 'a',
    });
    expect(second).toEqual({ ok: false, reason: 'already_reversed' });
  });

  it('refuse d’annuler une annulation', async () => {
    const { id } = await writeExpense(runner, base());
    const r = await reverseExpense(runner, {
      residenceId: RES,
      expenseId: id,
      reason: 'x',
      actorPersonId: 'a',
    });
    const reversalId = r.ok ? r.reversalId : '';
    const again = await reverseExpense(runner, {
      residenceId: RES,
      expenseId: reversalId,
      reason: 'x',
      actorPersonId: 'a',
    });
    expect(again).toEqual({ ok: false, reason: 'is_reversal' });
  });

  it('refuse une dépense introuvable', async () => {
    const r = await reverseExpense(runner, {
      residenceId: RES,
      expenseId: 'nope',
      reason: 'x',
      actorPersonId: 'a',
    });
    expect(r).toEqual({ ok: false, reason: 'not_found' });
  });
});
