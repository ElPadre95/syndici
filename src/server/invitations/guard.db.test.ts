/**
 * Garde d'émission (A6) : une invitation n'est possible que vers une personne
 * ayant un rattachement ACTIF sur le lot. On vérifie ici le prédicat exact sur
 * lequel `activeAttachmentRole` s'appuie (endDate IS NULL), au niveau base.
 */
import { describe, it, expect } from 'vitest';
import {
  freshDb,
  insertResidence,
  insertLot,
  insertPerson,
  insertLotAttachment,
} from '@/test/pglite';
import type { PGlite } from '@electric-sql/pglite';

async function activeRole(db: PGlite, lotId: string, personId: string): Promise<string | null> {
  const res = await db.query<{ role: string }>(
    'SELECT role FROM "LotAttachment" WHERE "lotId"=$1 AND "personId"=$2 AND "endDate" IS NULL LIMIT 1',
    [lotId, personId],
  );
  return res.rows[0]?.role ?? null;
}

describe('émission d’invitation — rattachement actif requis', () => {
  it('refuse une personne sans rattachement actif ; autorise une personne active', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await insertLot(db, 'lot1', 'r1', 'A1');
    await insertPerson(db, 'ancien'); // rattachement TERMINÉ
    await insertPerson(db, 'actuel'); // rattachement ACTIF

    await insertLotAttachment(db, {
      id: 'a-old',
      residenceId: 'r1',
      lotId: 'lot1',
      personId: 'ancien',
      role: 'TENANT',
      startDate: '2020-01-01',
      endDate: '2023-12-31',
    });
    await insertLotAttachment(db, {
      id: 'a-cur',
      residenceId: 'r1',
      lotId: 'lot1',
      personId: 'actuel',
      role: 'OWNER',
    });

    // Sans rattachement actif → aucun rôle → émission refusée.
    expect(await activeRole(db, 'lot1', 'ancien')).toBeNull();
    // Rattachement actif → rôle présent → émission possible.
    expect(await activeRole(db, 'lot1', 'actuel')).toBe('OWNER');
  });
});
