/**
 * Annuaire des résidents (F2) — invariants de la couche d'accès aux personnes, sur base
 * réelle (PGlite ET Postgres réel via test:pg). On prouve :
 *   - le cas MRE : une personne multi-lots apparaît UNE fois, ses lots agrégés ;
 *   - les rôles par lot (propriétaire d'un lot, locataire d'un autre) coexistent ;
 *   - `hasAccount` reflète l'existence d'un compte, sans exposer son identifiant ;
 *   - un rattachement terminé est marqué inactif ;
 *   - un rôle non-staff est refusé (aucune fuite d'annuaire).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  freshDb,
  pgliteExecutor,
  insertResidence,
  insertLot,
  insertPerson,
  insertUser,
  insertLotAttachment,
  type TestDb,
} from '@/test/pglite';
import type { SqlExecutor } from '@/server/db/sql';
import type { ActiveContext } from './context';
import { listResidentDirectory, PersonAccessError } from './person-access';

describe('listResidentDirectory', () => {
  let db: TestDb;
  let exec: SqlExecutor;
  const RES = 'res-1';
  const staff: ActiveContext = { personId: 'staff', residenceId: RES, role: 'SYNDIC' };

  beforeEach(async () => {
    db = await freshDb();
    exec = pgliteExecutor(db);
    await insertResidence(db, RES);
    await insertLot(db, 'lot-a1', RES, 'A1');
    await insertLot(db, 'lot-a2', RES, 'A2');
    await insertLot(db, 'lot-b1', RES, 'B1');

    // P1 : MRE avec compte activé, propriétaire de DEUX lots.
    await insertUser(db, 'user-1', 'mre@example.com');
    await insertPerson(db, 'p1', { authUserId: 'user-1', phone: '+33 6 12 34 56 78' });
    await insertLotAttachment(db, {
      id: 'att-1',
      residenceId: RES,
      lotId: 'lot-a1',
      personId: 'p1',
      role: 'OWNER',
    });
    await insertLotAttachment(db, {
      id: 'att-2',
      residenceId: RES,
      lotId: 'lot-a2',
      personId: 'p1',
      role: 'OWNER',
    });

    // P2 : sans compte, propriétaire d'un lot ET locataire d'un autre.
    await insertPerson(db, 'p2', {});
    await insertLotAttachment(db, {
      id: 'att-3',
      residenceId: RES,
      lotId: 'lot-b1',
      personId: 'p2',
      role: 'OWNER',
    });
    await insertLotAttachment(db, {
      id: 'att-4',
      residenceId: RES,
      lotId: 'lot-a1',
      personId: 'p2',
      role: 'TENANT',
    });

    // P3 : ancien locataire (rattachement terminé) → inactif.
    await insertPerson(db, 'p3', {});
    await insertLotAttachment(db, {
      id: 'att-5',
      residenceId: RES,
      lotId: 'lot-a2',
      personId: 'p3',
      role: 'TENANT',
      endDate: '2020-01-01',
    });
  });

  it('déduplique le MRE : une entrée, ses deux lots, compte activé', async () => {
    const dir = await listResidentDirectory(exec, staff);
    const p1 = dir.find((e) => e.id === 'p1');
    expect(p1).toBeDefined();
    expect(p1!.hasAccount).toBe(true);
    expect(p1!.lots.map((l) => l.reference)).toEqual(['A1', 'A2']);
    expect(p1!.lots.every((l) => l.role === 'OWNER' && l.active)).toBe(true);
    // Une seule entrée pour p1, jamais un doublon par lot.
    expect(dir.filter((e) => e.id === 'p1')).toHaveLength(1);
  });

  it('agrège les rôles mixtes propriétaire/locataire sans compte', async () => {
    const dir = await listResidentDirectory(exec, staff);
    const p2 = dir.find((e) => e.id === 'p2')!;
    expect(p2.hasAccount).toBe(false);
    const roles = new Set(p2.lots.map((l) => l.role));
    expect(roles).toEqual(new Set(['OWNER', 'TENANT']));
  });

  it('marque un rattachement terminé comme inactif', async () => {
    const dir = await listResidentDirectory(exec, staff);
    const p3 = dir.find((e) => e.id === 'p3')!;
    expect(p3.lots).toHaveLength(1);
    expect(p3.lots[0]!.active).toBe(false);
  });

  it('refuse un rôle non-staff (aucune fuite d’annuaire)', async () => {
    const resident: ActiveContext = { personId: 'p2', residenceId: RES, role: 'PROPRIETAIRE' };
    await expect(listResidentDirectory(exec, resident)).rejects.toBeInstanceOf(PersonAccessError);
  });
});
