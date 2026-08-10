/**
 * Test helper: an in-process Postgres (PGlite) with the REAL migration applied.
 * Lets DB-level invariants (partial-unique indexes, check constraints, sequence
 * continuity) be tested in the gate without any external Postgres server.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SqlExecutor, TxRunner } from '@/server/db/sql';

/** Fresh PGlite with every migration under prisma/migrations applied in order. */
export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  const migDir = join(process.cwd(), 'prisma', 'migrations');
  const dirs = readdirSync(migDir)
    .filter((d) => /^\d+_/.test(d))
    .sort();
  for (const d of dirs) {
    await db.exec(readFileSync(join(migDir, d, 'migration.sql'), 'utf8'));
  }
  return db;
}

/** Adapte PGlite à l'interface SqlExecutor utilisée par la couche sécurité. */
export function pgliteExecutor(db: Pick<PGlite, 'query'>): SqlExecutor {
  return {
    query: async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows,
  };
}

/** Adapte les transactions PGlite à l'interface TxRunner. */
export function pgliteTxRunner(db: PGlite): TxRunner {
  return {
    transaction: <T>(fn: (tx: SqlExecutor) => Promise<T>) =>
      db.transaction(async (tx) =>
        fn({
          query: async <U>(sql: string, params: unknown[] = []) =>
            (await tx.query<U>(sql, params)).rows,
        }),
      ) as Promise<T>,
  };
}

// ── Minimal insert helpers (explicit columns; @updatedAt / @db.Date have no SQL default) ──

export async function insertResidence(
  db: PGlite,
  id: string,
  name = 'Résidence Test',
): Promise<void> {
  await db.query('INSERT INTO "Residence"(id, name, "updatedAt") VALUES ($1,$2,now())', [id, name]);
}

export async function insertOrganization(
  db: PGlite,
  id: string,
  name = 'Cabinet Test',
): Promise<void> {
  await db.query('INSERT INTO "Organization"(id, name, "updatedAt") VALUES ($1,$2,now())', [
    id,
    name,
  ]);
}

export async function insertPerson(
  db: PGlite,
  id: string,
  opts: { email?: string; phone?: string; authUserId?: string } = {},
): Promise<void> {
  await db.query(
    'INSERT INTO "Person"(id, "firstName", "lastName", email, phone, "authUserId", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())',
    [id, 'Prénom', id, opts.email ?? null, opts.phone ?? null, opts.authUserId ?? null],
  );
}

export async function insertUser(db: PGlite, id: string, email?: string): Promise<void> {
  await db.query('INSERT INTO "User"(id, email) VALUES ($1,$2)', [id, email ?? null]);
}

export async function insertMandate(
  db: PGlite,
  opts: {
    id: string;
    organizationId: string;
    residenceId: string;
    status?: string;
    startDate?: string;
    endDate?: string | null;
  },
): Promise<void> {
  await db.query(
    'INSERT INTO "Mandate"(id, "organizationId", "residenceId", status, "startDate", "endDate") VALUES ($1,$2,$3,$4::"MandateStatus",$5::date,$6::date)',
    [
      opts.id,
      opts.organizationId,
      opts.residenceId,
      opts.status ?? 'ACTIVE',
      opts.startDate ?? '2024-01-01',
      opts.endDate ?? null,
    ],
  );
}

export async function insertMembership(
  db: PGlite,
  opts: { id: string; organizationId: string; personId: string; role?: string; status?: string },
): Promise<void> {
  await db.query(
    'INSERT INTO "Membership"(id, "organizationId", "personId", role, status) VALUES ($1,$2,$3,$4::"OrgRole",$5::"MembershipStatus")',
    [opts.id, opts.organizationId, opts.personId, opts.role ?? 'STAFF', opts.status ?? 'ACTIVE'],
  );
}

export async function insertLotAttachment(
  db: PGlite,
  opts: {
    id: string;
    residenceId: string;
    lotId: string;
    personId: string;
    role: string;
    startDate?: string;
    endDate?: string | null;
  },
): Promise<void> {
  await db.query(
    'INSERT INTO "LotAttachment"(id, "residenceId", "lotId", "personId", role, "startDate", "endDate") VALUES ($1,$2,$3,$4,$5::"AttachmentRole",$6::date,$7::date)',
    [
      opts.id,
      opts.residenceId,
      opts.lotId,
      opts.personId,
      opts.role,
      opts.startDate ?? '2024-01-01',
      opts.endDate ?? null,
    ],
  );
}

export async function insertLot(
  db: PGlite,
  id: string,
  residenceId: string,
  reference: string,
): Promise<void> {
  await db.query(
    'INSERT INTO "Lot"(id, "residenceId", reference, "updatedAt") VALUES ($1,$2,$3,now())',
    [id, residenceId, reference],
  );
}

export async function insertPayment(
  db: PGlite,
  id: string,
  residenceId: string,
  amountMinor: number,
): Promise<void> {
  await db.query(
    'INSERT INTO "Payment"(id, "residenceId", method, "amountMinor", "receivedAt") VALUES ($1,$2,$3,$4,now())',
    [id, residenceId, 'ESPECES', amountMinor],
  );
}
