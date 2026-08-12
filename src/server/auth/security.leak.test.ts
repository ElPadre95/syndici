/**
 * Tests de FUITE (§6) — intégration contre un vrai Postgres (PGlite). Ils
 * échoueraient si les gardes étaient contournées. Ils exercent le contexte
 * multi-résidences (context.ts) et la couche d'accès aux personnes (person-access.ts)
 * ensemble, sur un scénario proche du seed (résidences A/B, mandats, MRE).
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
import {
  getResidenceRole,
  listAccessibleResidences,
  resolveActiveContext,
  type ActiveContext,
} from './context';
import { getAccessiblePerson, listResidents } from './person-access';
import { can } from './permissions';
import type { SqlExecutor } from '@/server/db/sql';

const ids = {
  org: 'org-1',
  rA: 'res-A',
  rB: 'res-B',
  rC: 'res-C-no-mandate',
  rExp: 'res-Exp-expired',
  staff: 'p-staff',
  ownerA: 'p-owner-A',
  tenantA: 'p-tenant-A',
  ownerB: 'p-owner-B',
  tenantB: 'p-tenant-B',
  lotA1: 'lot-A1',
  lotB3: 'lot-B3',
  lotE1: 'lot-E1',
  outsider: 'p-outsider',
};

let db: TestDb;
let exec: SqlExecutor;

beforeAll(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);

  await insertOrganization(db, ids.org);
  for (const r of [ids.rA, ids.rB, ids.rC, ids.rExp]) await insertResidence(db, r);

  // Mandats : A et B actifs, C sans mandat, Exp expiré (endDate passée).
  await insertMandate(db, { id: 'm-A', organizationId: ids.org, residenceId: ids.rA });
  await insertMandate(db, { id: 'm-B', organizationId: ids.org, residenceId: ids.rB });
  await insertMandate(db, {
    id: 'm-Exp',
    organizationId: ids.org,
    residenceId: ids.rExp,
    endDate: '2025-01-01',
  });

  // Staff du cabinet (MANAGER → GESTIONNAIRE).
  await insertPerson(db, ids.staff, { email: 'staff@cabinet.ma' });
  await insertMembership(db, {
    id: 'mem-1',
    organizationId: ids.org,
    personId: ids.staff,
    role: 'MANAGER',
  });

  // Résidence A : lot A1 (propriétaire + locataire distincts).
  await insertLot(db, ids.lotA1, ids.rA, 'A1');
  await insertPerson(db, ids.ownerA, { email: 'owner.a@mre.fr', phone: '+33600000001' });
  await insertPerson(db, ids.tenantA, { email: 'tenant.a@mail.ma' });
  await insertLotAttachment(db, {
    id: 'la-A-o',
    residenceId: ids.rA,
    lotId: ids.lotA1,
    personId: ids.ownerA,
    role: 'OWNER',
  });
  await insertLotAttachment(db, {
    id: 'la-A-t',
    residenceId: ids.rA,
    lotId: ids.lotA1,
    personId: ids.tenantA,
    role: 'TENANT',
  });

  // Résidence B : lot B3.
  await insertLot(db, ids.lotB3, ids.rB, 'B3');
  await insertPerson(db, ids.ownerB, { email: 'owner.b@mre.uk', phone: '+44700000002' });
  await insertPerson(db, ids.tenantB, { email: 'tenant.b@mail.ma' });
  await insertLotAttachment(db, {
    id: 'la-B-o',
    residenceId: ids.rB,
    lotId: ids.lotB3,
    personId: ids.ownerB,
    role: 'OWNER',
  });
  await insertLotAttachment(db, {
    id: 'la-B-t',
    residenceId: ids.rB,
    lotId: ids.lotB3,
    personId: ids.tenantB,
    role: 'TENANT',
  });

  // Résidence expirée : un lot + propriétaire, pour prouver que l'historique
  // subsiste alors que l'accès staff tombe.
  await insertLot(db, ids.lotE1, ids.rExp, 'E1');

  // Une personne sans aucun rattachement — jamais atteignable.
  await insertPerson(db, ids.outsider, { email: 'ghost@nowhere.io' });
});

async function ctxOf(personId: string, residenceId: string): Promise<ActiveContext> {
  const c = await resolveActiveContext(exec, personId, residenceId);
  if (!c) throw new Error(`contexte inattendu null pour ${personId}@${residenceId}`);
  return c;
}

describe('§6.1 — isolation entre résidences', () => {
  it("un locataire de A n'obtient aucun contexte ni aucune donnée sur B", async () => {
    expect(await resolveActiveContext(exec, ids.tenantA, ids.rB)).toBeNull();
    expect(await getResidenceRole(exec, ids.tenantA, ids.rB)).toBeNull();
    expect(await listAccessibleResidences(exec, ids.tenantA)).toEqual([ids.rA]);
  });
});

describe('§6.2 — un locataire ne voit ni dépenses ni identité du propriétaire de SON lot (B3)', () => {
  it('LOCATAIRE de B3 : aucune donnée sur le propriétaire (nom, e-mail, téléphone)', async () => {
    const ctx = await ctxOf(ids.tenantB, ids.rB);
    expect(ctx.role).toBe('LOCATAIRE');
    // La couche d'accès refuse net : null, pas de fuite d'existence.
    expect(await getAccessiblePerson(exec, ctx, ids.ownerB)).toBeNull();
    // Et par la matrice : ni dépenses, ni identité propriétaire.
    expect(can(ctx.role, 'expense.view')).toBe(false);
    expect(can(ctx.role, 'owner.identity.view')).toBe(false);
    // listResidents lui est interdit (jette).
    await expect(listResidents(exec, ctx)).rejects.toThrow();
  });

  it('un locataire ne peut lire que lui-même', async () => {
    const ctx = await ctxOf(ids.tenantB, ids.rB);
    const self = await getAccessiblePerson(exec, ctx, ids.tenantB);
    expect(self?.id).toBe(ids.tenantB);
    expect(await getAccessiblePerson(exec, ctx, ids.tenantA)).toBeNull();
  });
});

describe("§6.3 — un gestionnaire n'atteint pas une résidence hors mandat actif", () => {
  it('résidence sans mandat : aucun rôle', async () => {
    expect(await getResidenceRole(exec, ids.staff, ids.rC)).toBeNull();
    expect(await resolveActiveContext(exec, ids.staff, ids.rC)).toBeNull();
  });

  it('résidences sous mandat actif : accessibles en GESTIONNAIRE', async () => {
    expect(await getResidenceRole(exec, ids.staff, ids.rA)).toBe('GESTIONNAIRE');
    const acc = await listAccessibleResidences(exec, ids.staff);
    expect(acc.sort()).toEqual([ids.rA, ids.rB].sort());
  });
});

describe("§6.4 — un mandat expiré retire l'accès sans supprimer l'historique", () => {
  it('mandat expiré : plus de rôle, résidence hors des accès', async () => {
    expect(await getResidenceRole(exec, ids.staff, ids.rExp)).toBeNull();
    expect(await listAccessibleResidences(exec, ids.staff)).not.toContain(ids.rExp);
    // L'historique subsiste : le lot et le mandat existent toujours en base.
    const lots = await exec.query('SELECT id FROM "Lot" WHERE id = $1', [ids.lotE1]);
    expect(lots).toHaveLength(1);
  });
});

describe("§6.6 — une personne non atteignable n'est jamais renvoyée", () => {
  it('un gestionnaire de A ne peut pas lire un propriétaire de B', async () => {
    const ctxA = await ctxOf(ids.staff, ids.rA);
    expect(await getAccessiblePerson(exec, ctxA, ids.ownerB)).toBeNull();
  });

  it('une personne sans aucun rattachement est invisible partout', async () => {
    const ctxA = await ctxOf(ids.staff, ids.rA);
    const ctxB = await ctxOf(ids.staff, ids.rB);
    expect(await getAccessiblePerson(exec, ctxA, ids.outsider)).toBeNull();
    expect(await getAccessiblePerson(exec, ctxB, ids.outsider)).toBeNull();
  });

  it("mais la couche N'EST PAS un simple « toujours null » : le staff lit ses propres résidents", async () => {
    const ctxA = await ctxOf(ids.staff, ids.rA);
    const owner = await getAccessiblePerson(exec, ctxA, ids.ownerA);
    expect(owner?.email).toBe('owner.a@mre.fr');
    const residents = await listResidents(exec, ctxA);
    expect(residents.map((r) => r.id).sort()).toEqual([ids.ownerA, ids.tenantA].sort());
  });
});

describe('cas MRE — propriétaire ici, locataire ailleurs', () => {
  it('la même personne peut être PROPRIETAIRE dans une résidence et LOCATAIRE dans une autre', async () => {
    // ownerA est propriétaire en A ; on le rattache aussi comme locataire en B,
    // sur un autre lot (un lot n'a qu'un locataire actif à la fois).
    await insertLot(db, 'lot-B4', ids.rB, 'B4');
    await insertLotAttachment(db, {
      id: 'la-B-mre',
      residenceId: ids.rB,
      lotId: 'lot-B4',
      personId: ids.ownerA,
      role: 'TENANT',
    });
    expect(await getResidenceRole(exec, ids.ownerA, ids.rA)).toBe('PROPRIETAIRE');
    expect(await getResidenceRole(exec, ids.ownerA, ids.rB)).toBe('LOCATAIRE');
  });
});
