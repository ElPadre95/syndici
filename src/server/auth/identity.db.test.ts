/**
 * Résolution d'identité (correctif « coquille vide ») — sur base réelle (PGlite ET
 * Postgres réel). On prouve que :
 *   - un `personId` inexistant ou nul est signalé `stale` (session périmée après reseed),
 *     PAS transformé en contexte vide silencieux ;
 *   - une personne réelle SANS résidence est `active` (onboarding légitime), pas `stale` ;
 *   - une personne staff réelle résout son rôle et sa résidence active ;
 *   - une résidence active périmée (cookie hors périmètre, résidence disparue, mandat
 *     expiré) ne casse rien : repli sur une accessible ou `null`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  freshDb,
  pgliteExecutor,
  insertResidence,
  insertOrganization,
  insertPerson,
  insertMandate,
  insertMembership,
  insertLot,
  insertLotAttachment,
  type TestDb,
} from '@/test/pglite';
import type { SqlExecutor } from '@/server/db/sql';
import { resolveIdentity } from './identity';

describe('resolveIdentity', () => {
  let db: TestDb;
  let exec: SqlExecutor;

  beforeEach(async () => {
    db = await freshDb();
    exec = pgliteExecutor(db);
  });

  it('un personId inexistant est PÉRIMÉ (jamais un contexte vide silencieux)', async () => {
    const res = await resolveIdentity(exec, 'ghost-person', null);
    expect(res.status).toBe('stale');
  });

  it('un personId nul/absent est périmé', async () => {
    expect((await resolveIdentity(exec, null, null)).status).toBe('stale');
    expect((await resolveIdentity(exec, undefined, null)).status).toBe('stale');
  });

  it('une personne réelle SANS résidence est active (onboarding), pas périmée', async () => {
    await insertPerson(db, 'p-new');
    const res = await resolveIdentity(exec, 'p-new', null);
    expect(res.status).toBe('active');
    if (res.status === 'active') {
      expect(res.accessibleIds).toEqual([]);
      expect(res.activeId).toBeNull();
      expect(res.role).toBeNull();
    }
  });

  it('un syndic réel résout son rôle et sa résidence active', async () => {
    await insertResidence(db, 'res-1');
    await insertOrganization(db, 'org-1');
    await insertPerson(db, 'p-syndic');
    await insertMembership(db, {
      id: 'mem-1',
      organizationId: 'org-1',
      personId: 'p-syndic',
      role: 'OWNER_ADMIN',
    });
    await insertMandate(db, { id: 'md-1', organizationId: 'org-1', residenceId: 'res-1' });

    const res = await resolveIdentity(exec, 'p-syndic', null);
    expect(res.status).toBe('active');
    if (res.status === 'active') {
      expect(res.accessibleIds).toEqual(['res-1']);
      expect(res.activeId).toBe('res-1');
      expect(res.role).toBe('SYNDIC');
    }
  });

  it('résidence active périmée : cookie hors périmètre → repli sur une accessible', async () => {
    await insertResidence(db, 'res-1');
    await insertPerson(db, 'p-owner');
    await insertLot(db, 'lot-1', 'res-1', 'A1');
    await insertLotAttachment(db, {
      id: 'att-1',
      residenceId: 'res-1',
      lotId: 'lot-1',
      personId: 'p-owner',
      role: 'OWNER',
    });

    // Cookie pointant vers une résidence disparue/inaccessible → ignoré, repli sur res-1.
    const res = await resolveIdentity(exec, 'p-owner', 'residence-disparue');
    expect(res.status).toBe('active');
    if (res.status === 'active') {
      expect(res.activeId).toBe('res-1');
      expect(res.role).toBe('PROPRIETAIRE');
    }
  });

  it('mandat expiré : plus aucune résidence accessible → activeId null, sans casser', async () => {
    await insertResidence(db, 'res-1');
    await insertOrganization(db, 'org-1');
    await insertPerson(db, 'p-ex');
    await insertMembership(db, {
      id: 'mem-1',
      organizationId: 'org-1',
      personId: 'p-ex',
      role: 'OWNER_ADMIN',
    });
    await insertMandate(db, {
      id: 'md-1',
      organizationId: 'org-1',
      residenceId: 'res-1',
      endDate: '2020-01-01', // mandat terminé
    });

    const res = await resolveIdentity(exec, 'p-ex', 'res-1');
    expect(res.status).toBe('active'); // la personne existe : pas périmée
    if (res.status === 'active') {
      expect(res.accessibleIds).toEqual([]);
      expect(res.activeId).toBeNull();
      expect(res.role).toBeNull();
    }
  });
});
