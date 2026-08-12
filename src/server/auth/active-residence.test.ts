/**
 * Tests d'ISOLATION du cookie de résidence active (A3 §1). Le cookie est traité
 * comme une entrée non fiable : seule une résidence réellement accessible (mandat
 * ACTIF non expiré pour le staff, lot courant pour un résident) peut être activée.
 * Ces tests échouent si quelqu'un contourne la revalidation plus tard.
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
import { listAccessibleResidences } from './context';
import { resolveActiveResidenceId } from './active-residence';
import type { SqlExecutor } from '@/server/db/sql';

describe('resolveActiveResidenceId — le cookie est une entrée non fiable', () => {
  const accessible = ['res-A', 'res-B'];

  it('honore un cookie qui vise une résidence accessible', () => {
    expect(resolveActiveResidenceId(accessible, 'res-B')).toBe('res-B');
  });

  it('rejette un cookie hors périmètre et retombe sur une résidence légitime', () => {
    expect(resolveActiveResidenceId(accessible, 'res-INTERDITE')).toBe('res-A');
  });

  it('ne plante pas sur une valeur inexistante, malformée, vide ou absente', () => {
    expect(resolveActiveResidenceId(accessible, '')).toBe('res-A');
    expect(resolveActiveResidenceId(accessible, '{}#injection')).toBe('res-A');
    expect(resolveActiveResidenceId(accessible, undefined)).toBe('res-A');
    expect(resolveActiveResidenceId(accessible, null)).toBe('res-A');
  });

  it("retombe sur aucune résidence quand l'ensemble accessible est vide", () => {
    expect(resolveActiveResidenceId([], 'res-A')).toBeNull();
    expect(resolveActiveResidenceId([], null)).toBeNull();
  });
});

describe('listAccessibleResidences — autorité de revalidation (vrai Postgres)', () => {
  const ids = {
    org: 'org-1',
    active: 'res-active',
    noMandate: 'res-no-mandate',
    expired: 'res-expired',
    staff: 'p-staff',
    residentLot: 'res-resident',
    otherLot: 'res-other',
    resident: 'p-resident',
    lotR: 'lot-r',
  };
  let db: TestDb;
  let exec: SqlExecutor;

  beforeAll(async () => {
    db = await freshDb();
    exec = pgliteExecutor(db);
    await insertOrganization(db, ids.org);
    for (const r of [ids.active, ids.noMandate, ids.expired, ids.residentLot, ids.otherLot]) {
      await insertResidence(db, r);
    }
    // Staff du cabinet : mandat actif sur `active`, mandat expiré sur `expired`,
    // aucun mandat sur `noMandate`.
    await insertPerson(db, ids.staff);
    await insertMembership(db, { id: 'mem-1', organizationId: ids.org, personId: ids.staff });
    await insertMandate(db, { id: 'm-active', organizationId: ids.org, residenceId: ids.active });
    await insertMandate(db, {
      id: 'm-expired',
      organizationId: ids.org,
      residenceId: ids.expired,
      endDate: '2025-01-01',
    });
    // Résident : détient un lot dans `residentLot`, rien dans `otherLot`.
    await insertPerson(db, ids.resident);
    await insertLot(db, ids.lotR, ids.residentLot, 'A1');
    await insertLotAttachment(db, {
      id: 'la-r',
      residenceId: ids.residentLot,
      lotId: ids.lotR,
      personId: ids.resident,
      role: 'TENANT',
    });
  });

  it('staff : mandat actif accessible, sans mandat et mandat expiré exclus', async () => {
    const set = await listAccessibleResidences(exec, ids.staff);
    expect(set).toContain(ids.active);
    expect(set).not.toContain(ids.noMandate);
    expect(set).not.toContain(ids.expired);
    // un cookie forgé vers une résidence expirée est donc rejeté
    expect(resolveActiveResidenceId(set, ids.expired)).toBe(ids.active);
  });

  it('résident : seule la résidence où il détient un lot est accessible', async () => {
    const set = await listAccessibleResidences(exec, ids.resident);
    expect(set).toEqual([ids.residentLot]);
    // un cookie forgé vers une résidence sans lot est rejeté
    expect(resolveActiveResidenceId(set, ids.otherLot)).toBe(ids.residentLot);
    expect(resolveActiveResidenceId(set, ids.active)).toBe(ids.residentLot);
  });
});
