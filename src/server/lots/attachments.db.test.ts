/**
 * Rattachements — invariants au niveau base (PGlite = vrai Postgres). Le code
 * applicatif (attachments.ts) s'appuie sur ces prédicats : scope par résidence
 * (cas MRE), historisation (date de fin), unicité du rôle actif.
 */
import { describe, it, expect } from 'vitest';
import {
  freshDb,
  insertResidence,
  insertPerson,
  insertLot,
  insertLotAttachment,
} from '@/test/pglite';
import type { PGlite } from '@electric-sql/pglite';

async function activeAttachments(db: PGlite, residenceId: string, lotId: string) {
  const res = await db.query<{ personId: string; role: string }>(
    'SELECT "personId", role FROM "LotAttachment" WHERE "residenceId"=$1 AND "lotId"=$2 AND "endDate" IS NULL',
    [residenceId, lotId],
  );
  return res.rows;
}

describe('rattachements — cas MRE (même personne, deux résidences)', () => {
  it('la même personne détient un lot dans deux résidences ; chaque résidence ne voit que le sien', async () => {
    const db = await freshDb();
    await insertResidence(db, 'rA');
    await insertResidence(db, 'rB');
    await insertLot(db, 'lotA', 'rA', 'A1');
    await insertLot(db, 'lotB', 'rB', 'B1');
    await insertPerson(db, 'mre'); // le MRE

    await insertLotAttachment(db, {
      id: 'x1',
      residenceId: 'rA',
      lotId: 'lotA',
      personId: 'mre',
      role: 'OWNER',
    });
    await insertLotAttachment(db, {
      id: 'x2',
      residenceId: 'rB',
      lotId: 'lotB',
      personId: 'mre',
      role: 'OWNER',
    });

    const inA = await activeAttachments(db, 'rA', 'lotA');
    const inB = await activeAttachments(db, 'rB', 'lotB');
    expect(inA).toHaveLength(1);
    expect(inB).toHaveLength(1);
    // C'est bien LA MÊME personne…
    expect(inA[0]!.personId).toBe('mre');
    expect(inB[0]!.personId).toBe('mre');
    // …mais la résidence A ne voit pas le rattachement de B (scope tenant).
    expect(await activeAttachments(db, 'rA', 'lotB')).toHaveLength(0);
  });
});

describe('rattachements — historisation', () => {
  it('un rattachement terminé n’est plus actif mais reste dans l’historique', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await insertLot(db, 'lot1', 'r1', 'C1');
    await insertPerson(db, 'oldTenant');
    await insertPerson(db, 'newTenant');

    await insertLotAttachment(db, {
      id: 'e1',
      residenceId: 'r1',
      lotId: 'lot1',
      personId: 'oldTenant',
      role: 'TENANT',
      startDate: '2021-06-01',
      endDate: '2024-08-31',
    });
    await insertLotAttachment(db, {
      id: 'e2',
      residenceId: 'r1',
      lotId: 'lot1',
      personId: 'newTenant',
      role: 'TENANT',
      startDate: '2024-09-01',
    });

    const active = await activeAttachments(db, 'r1', 'lot1');
    expect(active.map((a) => a.personId)).toEqual(['newTenant']); // l'ancien n'est plus actif

    const history = await db.query('SELECT id FROM "LotAttachment" WHERE "lotId"=$1', ['lot1']);
    expect(history.rows).toHaveLength(2); // …mais reste consultable
  });
});

describe('rattachements — unicité du rôle actif (chevauchement refusé, vente possible)', () => {
  it('refuse un second propriétaire actif, mais l’autorise après la fin du premier', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await insertLot(db, 'lot1', 'r1', 'D1');
    await insertPerson(db, 'owner1');
    await insertPerson(db, 'owner2');

    await insertLotAttachment(db, {
      id: 'o1',
      residenceId: 'r1',
      lotId: 'lot1',
      personId: 'owner1',
      role: 'OWNER',
    });
    // chevauchement : deuxième propriétaire actif → rejeté par l'index partiel
    await expect(
      insertLotAttachment(db, {
        id: 'o2',
        residenceId: 'r1',
        lotId: 'lot1',
        personId: 'owner2',
        role: 'OWNER',
      }),
    ).rejects.toThrow();

    // vente : on termine le premier, puis on rattache le nouveau (sans trou)
    await db.query('UPDATE "LotAttachment" SET "endDate"=$2 WHERE id=$1', ['o1', '2026-01-31']);
    await insertLotAttachment(db, {
      id: 'o2',
      residenceId: 'r1',
      lotId: 'lot1',
      personId: 'owner2',
      role: 'OWNER',
      startDate: '2026-02-01',
    });
    const active = await activeAttachments(db, 'r1', 'lot1');
    expect(active.map((a) => a.personId)).toEqual(['owner2']);
  });

  it('un chevauchement avec une NOUVELLE personne ne laisse aucun orphelin (transaction)', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await insertLot(db, 'lot1', 'r1', 'F1');
    await insertPerson(db, 'owner1');
    await insertLotAttachment(db, {
      id: 'a1',
      residenceId: 'r1',
      lotId: 'lot1',
      personId: 'owner1',
      role: 'OWNER',
    });
    const before = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM "Person"'))
      .rows[0]!.n;

    // Même séquence que attachPerson : créer la personne PUIS rattacher (chevauchement)
    // dans une seule transaction → l'index rejette → tout est annulé.
    await expect(
      db.transaction(async (tx) => {
        const p = await tx.query<{ id: string }>(
          'INSERT INTO "Person"(id,"firstName","lastName","updatedAt") VALUES (gen_random_uuid(),$1,$2,now()) RETURNING id',
          ['Nouveau', 'Doublon'],
        );
        await tx.query(
          'INSERT INTO "LotAttachment"(id,"residenceId","lotId","personId",role,"startDate") VALUES (gen_random_uuid(),$1,$2,$3,$4::"AttachmentRole",now())',
          ['r1', 'lot1', p.rows[0]!.id, 'OWNER'],
        );
      }),
    ).rejects.toThrow();

    const after = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM "Person"'))
      .rows[0]!.n;
    expect(after).toBe(before); // la personne « Nouveau Doublon » n'a pas été écrite
  });
});
