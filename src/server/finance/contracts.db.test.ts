/**
 * Contrats fournisseurs (C3) — invariants au niveau base. PGlite (gate) ET Postgres réel
 * (`npm run test:pg`). Prouve : création tracée à l'audit, archivage (soft delete) tracé,
 * refus d'archiver un contrat inexistant.
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
import { writeContract, archiveContract } from './contracts';

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

async function auditCount(action: string): Promise<number> {
  return (
    await exec.query<{ n: number }>(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action = $1`, [
      action,
    ])
  )[0]!.n;
}

const base = () => ({
  residenceId: RES,
  name: 'Assurance immeuble',
  supplierName: 'Wafa Assurance',
  amountMinor: 1200000,
  startDate: null,
  endDate: new Date('2026-12-31T00:00:00Z'),
  frequency: 'ANNUEL' as const,
  actorPersonId: 'actor',
});

describe('writeContract', () => {
  it('crée le contrat et trace l’audit', async () => {
    const id = await writeContract(runner, base());
    const row = await exec.query<{ name: string; amountMinor: number; frequency: string }>(
      `SELECT name, "amountMinor", frequency FROM "SupplierContract" WHERE id = $1`,
      [id],
    );
    expect(row[0]).toEqual({
      name: 'Assurance immeuble',
      amountMinor: 1200000,
      frequency: 'ANNUEL',
    });
    expect(await auditCount('contract.record')).toBe(1);
  });
});

describe('archiveContract', () => {
  it('archive (soft delete) et trace l’audit', async () => {
    const id = await writeContract(runner, base());
    const res = await archiveContract(runner, {
      residenceId: RES,
      contractId: id,
      actorPersonId: 'actor',
    });
    expect(res).toEqual({ ok: true });
    const archived = await exec.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "SupplierContract" WHERE id = $1 AND "archivedAt" IS NOT NULL`,
      [id],
    );
    expect(archived[0]!.n).toBe(1);
    expect(await auditCount('contract.archive')).toBe(1);
  });

  it('refuse d’archiver un contrat inexistant', async () => {
    const res = await archiveContract(runner, {
      residenceId: RES,
      contractId: 'nope',
      actorPersonId: 'actor',
    });
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });
});
