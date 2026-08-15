/**
 * MUR DES INCIDENTS — tests de fuite (§6, H1), PGlite + Postgres réel. Un résident ne voit
 * que les incidents de SES lots et ceux des parties communes de sa résidence ; jamais ceux
 * d'un autre lot ni d'une autre résidence. La photo suit la même règle.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { TestDb } from '@/test/pglite';
import {
  freshDb,
  pgliteExecutor,
  insertResidence,
  insertOrganization,
  insertPerson,
  insertLot,
  insertMandate,
  insertMembership,
  insertLotAttachment,
} from '@/test/pglite';
import { canAccessIncident, canServeIncidentPhoto } from './access';
import type { ActiveContext } from '@/server/auth/context';
import type { SqlExecutor } from '@/server/db/sql';

const ids = {
  org: 'org-1',
  rA: 'res-A',
  rB: 'res-B',
  staff: 'p-staff',
  ownerA1: 'p-owner-A1',
  ownerA2: 'p-owner-A2',
  ownerB1: 'p-owner-B1',
  lotA1: 'lot-A1',
  lotA2: 'lot-A2',
  lotB1: 'lot-B1',
  incA1: 'inc-A1',
  incCommonA: 'inc-common-A',
  incA2: 'inc-A2',
  incB1: 'inc-B1',
  photoA1: 'file-A1-photo',
};

let db: TestDb;
let exec: SqlExecutor;

async function insertIncident(
  d: TestDb,
  o: { id: string; residenceId: string; lotId: string | null; photoId?: string },
): Promise<void> {
  await d.query(
    `INSERT INTO "Incident"(id,"residenceId","lotId",category,location,description,urgency,status,"photoId")
     VALUES ($1,$2,$3,'Fuite','Couloir','desc','NORMALE'::"IncidentUrgency",'NOUVEAU'::"IncidentStatus",$4)`,
    [o.id, o.residenceId, o.lotId, o.photoId ?? null],
  );
}
async function insertFile(d: TestDb, id: string, residenceId: string): Promise<void> {
  await d.query(
    `INSERT INTO "FileAsset"(id,"residenceId",bucket,"storageKey","mimeType","originalName")
     VALUES ($1,$2,'incidents',$3,'image/jpeg','photo.jpg')`,
    [id, residenceId, `local:${residenceId}/incidents/${id}.jpg`],
  );
}
const ctx = (personId: string, residenceId: string, role: ActiveContext['role']): ActiveContext => ({
  personId,
  residenceId,
  role,
});

beforeAll(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);
  await insertOrganization(db, ids.org);
  await insertResidence(db, ids.rA);
  await insertResidence(db, ids.rB);
  await insertMandate(db, { id: 'm-A', organizationId: ids.org, residenceId: ids.rA });
  await insertMandate(db, { id: 'm-B', organizationId: ids.org, residenceId: ids.rB });
  await insertPerson(db, ids.staff);
  await insertMembership(db, { id: 'mem-1', organizationId: ids.org, personId: ids.staff, role: 'MANAGER' });

  await insertLot(db, ids.lotA1, ids.rA, 'A1');
  await insertLot(db, ids.lotA2, ids.rA, 'A2');
  await insertLot(db, ids.lotB1, ids.rB, 'B1');
  for (const [p, lot, res] of [
    [ids.ownerA1, ids.lotA1, ids.rA],
    [ids.ownerA2, ids.lotA2, ids.rA],
    [ids.ownerB1, ids.lotB1, ids.rB],
  ] as const) {
    await insertPerson(db, p);
    await insertLotAttachment(db, { id: `la-${p}`, residenceId: res, lotId: lot, personId: p, role: 'OWNER' });
  }

  await insertFile(db, ids.photoA1, ids.rA);
  await insertIncident(db, { id: ids.incA1, residenceId: ids.rA, lotId: ids.lotA1, photoId: ids.photoA1 });
  await insertIncident(db, { id: ids.incCommonA, residenceId: ids.rA, lotId: null });
  await insertIncident(db, { id: ids.incA2, residenceId: ids.rA, lotId: ids.lotA2 });
  await insertIncident(db, { id: ids.incB1, residenceId: ids.rB, lotId: ids.lotB1 });
});

describe('le mur — le propriétaire ne voit que ses lots + les parties communes', () => {
  it('voit un incident de SON lot et un incident de PARTIE COMMUNE', async () => {
    const o = ctx(ids.ownerA1, ids.rA, 'PROPRIETAIRE');
    expect(await canAccessIncident(exec, o, ids.incA1)).not.toBeNull();
    expect(await canAccessIncident(exec, o, ids.incCommonA)).not.toBeNull();
  });
  it("ne voit JAMAIS l'incident d'un autre lot", async () => {
    const o = ctx(ids.ownerA1, ids.rA, 'PROPRIETAIRE');
    expect(await canAccessIncident(exec, o, ids.incA2)).toBeNull();
  });
  it("ne voit pas un incident d'une autre résidence", async () => {
    const o = ctx(ids.ownerA1, ids.rA, 'PROPRIETAIRE');
    expect(await canAccessIncident(exec, o, ids.incB1)).toBeNull();
  });
});

describe('le mur — la photo suit le même accès', () => {
  it('le propriétaire du lot sert la photo de son incident ; un autre propriétaire non', async () => {
    expect(await canServeIncidentPhoto(exec, ctx(ids.ownerA1, ids.rA, 'PROPRIETAIRE'), ids.photoA1)).toBe(true);
    expect(await canServeIncidentPhoto(exec, ctx(ids.ownerA2, ids.rA, 'PROPRIETAIRE'), ids.photoA1)).toBe(false);
    expect(await canServeIncidentPhoto(exec, ctx(ids.staff, ids.rA, 'GESTIONNAIRE'), ids.photoA1)).toBe(true);
  });
});

describe('le mur — le staff voit sa résidence, aucune autre', () => {
  it('le staff actif en A voit A1, la partie commune et A2, mais pas B1', async () => {
    const s = ctx(ids.staff, ids.rA, 'GESTIONNAIRE');
    expect(await canAccessIncident(exec, s, ids.incA1)).not.toBeNull();
    expect(await canAccessIncident(exec, s, ids.incCommonA)).not.toBeNull();
    expect(await canAccessIncident(exec, s, ids.incA2)).not.toBeNull();
    expect(await canAccessIncident(exec, s, ids.incB1)).toBeNull();
    expect(await canAccessIncident(exec, ctx(ids.staff, ids.rB, 'GESTIONNAIRE'), ids.incB1)).not.toBeNull();
  });
});
