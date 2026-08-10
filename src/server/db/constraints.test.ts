import { describe, it, expect } from 'vitest';
import {
  freshDb,
  insertResidence,
  insertOrganization,
  insertPerson,
  insertLot,
} from '@/test/pglite';

const activeOwner = (
  db: Awaited<ReturnType<typeof freshDb>>,
  id: string,
  lotId: string,
  personId: string,
  role = 'OWNER',
  chargePayer = false,
) =>
  db.query(
    'INSERT INTO "LotAttachment"(id, "residenceId", "lotId", "personId", role, "isChargePayer", "startDate") VALUES ($1,$2,$3,$4,$5,$6,now())',
    [id, 'r1', lotId, personId, role, chargePayer],
  );

describe('DB invariants (partial-unique indexes & checks, via PGlite)', () => {
  it('allows at most one ACTIVE owner per lot', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await insertLot(db, 'lotB3', 'r1', 'B3');
    await insertPerson(db, 'p1');
    await insertPerson(db, 'p2');
    await activeOwner(db, 'a1', 'lotB3', 'p1');
    await expect(activeOwner(db, 'a2', 'lotB3', 'p2')).rejects.toThrow(); // 2nd active owner
  });

  it('allows one active owner AND one active tenant on the same lot', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await insertLot(db, 'lotB3', 'r1', 'B3');
    await insertPerson(db, 'p1');
    await insertPerson(db, 'p2');
    await activeOwner(db, 'a1', 'lotB3', 'p1', 'OWNER');
    await expect(activeOwner(db, 'a2', 'lotB3', 'p2', 'TENANT')).resolves.toBeDefined();
  });

  it('allows at most one ACTIVE charge payer per lot', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await insertLot(db, 'lotB3', 'r1', 'B3');
    await insertPerson(db, 'p1');
    await insertPerson(db, 'p2');
    await activeOwner(db, 'a1', 'lotB3', 'p1', 'OWNER', true);
    await expect(activeOwner(db, 'a2', 'lotB3', 'p2', 'TENANT', true)).rejects.toThrow();
  });

  it('allows at most one ACTIVE mandate per residence', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await insertOrganization(db, 'o1');
    await insertOrganization(db, 'o2');
    const mandate = (id: string, orgId: string) =>
      db.query(
        'INSERT INTO "Mandate"(id, "organizationId", "residenceId", status, "startDate") VALUES ($1,$2,$3,$4,now())',
        [id, orgId, 'r1', 'ACTIVE'],
      );
    await mandate('m1', 'o1');
    await expect(mandate('m2', 'o2')).rejects.toThrow();
  });

  it('a settlement account is attached to exactly one of org/residence (XOR check)', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await insertOrganization(db, 'o1');
    const acct = (id: string, orgId: string | null, resId: string | null) =>
      db.query(
        'INSERT INTO "SettlementAccount"(id, "organizationId", "residenceId", provider, status) VALUES ($1,$2,$3,$4,$5)',
        [id, orgId, resId, 'MANUAL', 'ACTIVE'],
      );
    await expect(acct('s1', 'o1', null)).resolves.toBeDefined(); // org only: ok
    await expect(acct('s2', null, 'r1')).resolves.toBeDefined(); // residence only: ok
    await expect(acct('s3', 'o1', 'r1')).rejects.toThrow(); // both: rejected
    await expect(acct('s4', null, null)).rejects.toThrow(); // neither: rejected
  });

  it('rejects a zero-amount payment', async () => {
    const db = await freshDb();
    await insertResidence(db, 'r1');
    await expect(
      db.query(
        'INSERT INTO "Payment"(id, "residenceId", method, "amountMinor", "receivedAt") VALUES ($1,$2,$3,$4,now())',
        ['pz', 'r1', 'ESPECES', 0],
      ),
    ).rejects.toThrow();
  });

  it('a lot cannot exist without a residence (FK NOT NULL)', async () => {
    const db = await freshDb();
    await expect(
      db.query(
        'INSERT INTO "Lot"(id, "residenceId", reference, "updatedAt") VALUES ($1,$2,$3,now())',
        ['x', 'ghost', 'Z9'],
      ),
    ).rejects.toThrow();
  });
});
