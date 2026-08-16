/**
 * Régularisation annuelle (I3) — invariant DB : IDEMPOTENCE. Au plus UNE régularisation
 * active par (résidence, exercice), garantie par un index partiel `WHERE voidedAt IS NULL`.
 * Rejouer la validation ne double jamais ; l'annuler libère l'exercice. PGlite et Postgres réel.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { TestDb } from '@/test/pglite';
import { freshDb, insertResidence } from '@/test/pglite';

let db: TestDb;

async function insertReg(
  d: TestDb,
  o: { id: string; residenceId: string; exercice: number; voided?: boolean },
): Promise<void> {
  await d.query(
    `INSERT INTO "Regularisation"
       (id,"residenceId",exercice,"effectiveOn","totalExpensesMinor","totalProvisionsMinor","voidedAt")
     VALUES ($1,$2,$3,CURRENT_DATE,0,0,$4)`,
    [o.id, o.residenceId, o.exercice, o.voided ? new Date() : null],
  );
}

beforeAll(async () => {
  db = await freshDb();
  await insertResidence(db, 'res-1');
});

describe('idempotence — au plus une régularisation active par exercice', () => {
  it('une seconde régularisation ACTIVE sur le même exercice est refusée', async () => {
    await insertReg(db, { id: 'r-1', residenceId: 'res-1', exercice: 2026 });
    await expect(
      insertReg(db, { id: 'r-2', residenceId: 'res-1', exercice: 2026 }),
    ).rejects.toThrow();
  });

  it('un exercice DIFFÉRENT est autorisé', async () => {
    await insertReg(db, { id: 'r-3', residenceId: 'res-1', exercice: 2025 });
    const n = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "Regularisation" WHERE "residenceId" = 'res-1'`,
    );
    expect(n.rows[0]!.n).toBe(2);
  });

  it('annuler (voidedAt) libère l’exercice : on peut en refaire une', async () => {
    // annule la régularisation 2026 active
    await db.query(`UPDATE "Regularisation" SET "voidedAt" = now() WHERE id = 'r-1'`);
    // une nouvelle sur 2026 passe désormais
    await insertReg(db, { id: 'r-4', residenceId: 'res-1', exercice: 2026 });
    const active = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "Regularisation"
         WHERE "residenceId" = 'res-1' AND exercice = 2026 AND "voidedAt" IS NULL`,
    );
    expect(active.rows[0]!.n).toBe(1); // exactement une active
  });
});
