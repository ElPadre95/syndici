/**
 * Écriture d'une campagne d'appels (B1) — invariants au niveau base. Tourne sur PGlite
 * (gate) ET Postgres réel (`npm run test:pg`). Prouve : un appel par lot, trace d'audit,
 * IDEMPOTENCE (rejouer une période ne duplique rien), et cloisonnement par période.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  freshDb,
  pgliteExecutor,
  pgliteTxRunner,
  insertResidence,
  insertLot,
  insertPerson,
  type TestDb,
} from '@/test/pglite';
import type { SqlExecutor, TxRunner } from '@/server/db/sql';
import { writeCampaign } from './campaigns';

let db: TestDb;
let exec: SqlExecutor;
let runner: TxRunner;
const RES = 'res-1';
const AOUT = { year: 2026, month: 8 };
const DUE_AOUT = new Date(Date.UTC(2026, 7, 1));

beforeEach(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);
  runner = pgliteTxRunner(db);
  await insertResidence(db, RES);
  await insertPerson(db, 'actor-1'); // acteur de l'audit (FK)
  await insertLot(db, 'lot-A', RES, 'A1');
  await insertLot(db, 'lot-B', RES, 'B1');
});

async function callCount(): Promise<number> {
  return (await exec.query<{ n: number }>('SELECT count(*)::int AS n FROM "ChargeCall"'))[0]!.n;
}
async function auditCount(): Promise<number> {
  return (
    await exec.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "AuditLog" WHERE action = 'chargeCall.campaign.generate'`,
    )
  )[0]!.n;
}

describe('writeCampaign', () => {
  it('crée un appel par lot avec le bon montant + une trace d’audit', async () => {
    const created = await writeCampaign(
      runner,
      RES,
      'actor-1',
      AOUT,
      DUE_AOUT,
      [
        { lotId: 'lot-A', amountMinor: 65000 },
        { lotId: 'lot-B', amountMinor: 120000 },
      ],
      185000,
    );
    expect(created).toBe(2);
    expect(await callCount()).toBe(2);
    expect(await auditCount()).toBe(1);
    const amounts = (
      await exec.query<{ amountMinor: number }>(
        'SELECT "amountMinor" FROM "ChargeCall" ORDER BY "amountMinor"',
      )
    ).map((r) => r.amountMinor);
    expect(amounts).toEqual([65000, 120000]);
    // l'échéance est bien une date (cast ::date OK sur Postgres réel)
    const due = await exec.query<{ d: string }>(
      `SELECT to_char("dueDate",'YYYY-MM-DD') AS d FROM "ChargeCall" LIMIT 1`,
    );
    expect(due[0]!.d).toBe('2026-08-01');
  });

  it('rejouer la MÊME période ne duplique rien (idempotence)', async () => {
    const toCall = [
      { lotId: 'lot-A', amountMinor: 65000 },
      { lotId: 'lot-B', amountMinor: 120000 },
    ];
    await writeCampaign(runner, RES, 'actor-1', AOUT, DUE_AOUT, toCall, 185000);
    const again = await writeCampaign(runner, RES, 'actor-1', AOUT, DUE_AOUT, toCall, 185000);
    expect(again).toBe(0); // rien de nouveau
    expect(await callCount()).toBe(2); // toujours 2 appels
  });

  it('une autre période crée de nouveaux appels pour les mêmes lots', async () => {
    await writeCampaign(
      runner,
      RES,
      'actor-1',
      AOUT,
      DUE_AOUT,
      [{ lotId: 'lot-A', amountMinor: 65000 }],
      65000,
    );
    await writeCampaign(
      runner,
      RES,
      'actor-1',
      { year: 2026, month: 9 },
      new Date(Date.UTC(2026, 8, 1)),
      [{ lotId: 'lot-A', amountMinor: 65000 }],
      65000,
    );
    expect(await callCount()).toBe(2); // A1 appelé pour août ET septembre
  });
});
