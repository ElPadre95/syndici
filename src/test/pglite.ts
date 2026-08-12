/**
 * Harnais de test DB à DEUX dorsales, derrière une seule interface `TestDb` :
 *
 *   - PGlite (défaut) : Postgres en process, la vraie migration appliquée. Rapide,
 *     hors-ligne, utilisé par le gate.
 *   - Postgres RÉEL (TEST_DB=pg) : un client Prisma dédié pointé sur une base de
 *     test. Il REPRODUIT le binding de paramètres de la production (c'est ce binding
 *     qui, en typant les chaînes ISO comme `text`, avait cassé `createInvitation`
 *     alors que PGlite le tolérait). Lancer `npm run test:pg` fait tourner les mêmes
 *     tests d'invariants contre un vrai Postgres pour débusquer ces divergences.
 *
 * Les tests écrivent `db.query(sql, params)` → `{ rows }` et `db.transaction(fn)` ;
 * les deux dorsales exposent exactement cette forme, donc un test unique couvre les
 * deux moteurs sans modification.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SqlExecutor, TxRunner } from '@/server/db/sql';

/** Exécuteur minimal : une requête paramétrée renvoyant des lignes. */
export interface TestExec {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/** Base de test : un exécuteur + des transactions. Commun aux deux dorsales. */
export interface TestDb extends TestExec {
  transaction<T>(fn: (tx: TestExec) => Promise<T>): Promise<T>;
}

const USE_PG = process.env.TEST_DB === 'pg';

// ── Dorsale PGlite (défaut) ────────────────────────────────────────────────

/** Fresh PGlite avec toutes les migrations de prisma/migrations appliquées dans l'ordre. */
async function freshPglite(): Promise<TestDb> {
  const db = new PGlite();
  const migDir = join(process.cwd(), 'prisma', 'migrations');
  const dirs = readdirSync(migDir)
    .filter((d) => /^\d+_/.test(d))
    .sort();
  for (const d of dirs) {
    await db.exec(readFileSync(join(migDir, d, 'migration.sql'), 'utf8'));
  }
  return {
    query: async <T>(sql: string, params: unknown[] = []) => ({
      rows: (await db.query<T>(sql, params)).rows,
    }),
    transaction: <T>(fn: (tx: TestExec) => Promise<T>) =>
      db.transaction(async (tx) =>
        fn({
          query: async <U>(sql: string, params: unknown[] = []) => ({
            rows: (await tx.query<U>(sql, params)).rows,
          }),
        }),
      ) as Promise<T>,
  };
}

// ── Dorsale Postgres réel (TEST_DB=pg) ─────────────────────────────────────

type PrismaLike = {
  $queryRawUnsafe<T = unknown>(sql: string, ...params: unknown[]): Promise<T>;
  $executeRawUnsafe(sql: string, ...params: unknown[]): Promise<number>;
  $transaction<T>(fn: (tx: PrismaLike) => Promise<T>): Promise<T>;
  $disconnect(): Promise<void>;
};

let _pg: PrismaLike | null = null;

function pgClient(): PrismaLike {
  if (!_pg) {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) {
      throw new Error(
        'TEST_DB=pg exige TEST_DATABASE_URL (base de test jetable). Utilise `npm run test:pg`.',
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client') as typeof import('@prisma/client');
    _pg = new PrismaClient({ datasources: { db: { url } } }) as unknown as PrismaLike;
    // Le client tient l'event loop ouvert : on le referme à l'extinction du worker.
    process.once('beforeExit', () => {
      void _pg?.$disconnect();
    });
  }
  return _pg;
}

/**
 * « Base fraîche » sur Postgres réel : on ne rejoue pas les migrations (faites une
 * fois par `test:pg`), on TRONQUE toutes les tables entre les tests pour l'isolation.
 * Le run pg est mono-worker (voir script) : pas de course entre fichiers.
 */
async function freshPg(): Promise<TestDb> {
  const client = pgClient();
  const tables = await client.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await client.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  }
  return {
    query: async <T>(sql: string, params: unknown[] = []) => ({
      rows: await client.$queryRawUnsafe<T[]>(sql, ...params),
    }),
    transaction: <T>(fn: (tx: TestExec) => Promise<T>) =>
      client.$transaction((tx) =>
        fn({
          query: async <U>(sql: string, params: unknown[] = []) => ({
            rows: await tx.$queryRawUnsafe<U[]>(sql, ...params),
          }),
        }),
      ),
  };
}

/** Base de test fraîche, dorsale selon TEST_DB (pglite par défaut, pg si TEST_DB=pg). */
export function freshDb(): Promise<TestDb> {
  return USE_PG ? freshPg() : freshPglite();
}

/** Adapte une base/exécuteur de test à l'interface SqlExecutor de la couche sécurité. */
export function pgliteExecutor(db: TestExec): SqlExecutor {
  return {
    query: async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows,
  };
}

/** Adapte les transactions de test à l'interface TxRunner. */
export function pgliteTxRunner(db: TestDb): TxRunner {
  return {
    transaction: <T>(fn: (tx: SqlExecutor) => Promise<T>) =>
      db.transaction((tx) =>
        fn({
          query: async <U>(sql: string, params: unknown[] = []) =>
            (await tx.query<U>(sql, params)).rows,
        }),
      ),
  };
}

// ── Helpers d'insertion (colonnes explicites ; @updatedAt / @db.Date sans défaut SQL) ──

export async function insertResidence(
  db: TestDb,
  id: string,
  name = 'Résidence Test',
): Promise<void> {
  await db.query('INSERT INTO "Residence"(id, name, "updatedAt") VALUES ($1,$2,now())', [id, name]);
}

export async function insertOrganization(
  db: TestDb,
  id: string,
  name = 'Cabinet Test',
): Promise<void> {
  await db.query('INSERT INTO "Organization"(id, name, "updatedAt") VALUES ($1,$2,now())', [
    id,
    name,
  ]);
}

export async function insertPerson(
  db: TestDb,
  id: string,
  opts: { email?: string; phone?: string; authUserId?: string } = {},
): Promise<void> {
  await db.query(
    'INSERT INTO "Person"(id, "firstName", "lastName", email, phone, "authUserId", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())',
    [id, 'Prénom', id, opts.email ?? null, opts.phone ?? null, opts.authUserId ?? null],
  );
}

export async function insertUser(db: TestDb, id: string, email?: string): Promise<void> {
  await db.query('INSERT INTO "User"(id, email) VALUES ($1,$2)', [id, email ?? null]);
}

export async function insertMandate(
  db: TestDb,
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
  db: TestDb,
  opts: { id: string; organizationId: string; personId: string; role?: string; status?: string },
): Promise<void> {
  await db.query(
    'INSERT INTO "Membership"(id, "organizationId", "personId", role, status) VALUES ($1,$2,$3,$4::"OrgRole",$5::"MembershipStatus")',
    [opts.id, opts.organizationId, opts.personId, opts.role ?? 'STAFF', opts.status ?? 'ACTIVE'],
  );
}

export async function insertLotAttachment(
  db: TestDb,
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
  db: TestDb,
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
  db: TestDb,
  id: string,
  residenceId: string,
  amountMinor: number,
): Promise<void> {
  await db.query(
    'INSERT INTO "Payment"(id, "residenceId", method, "amountMinor", "receivedAt") VALUES ($1,$2,$3::"PaymentMethod",$4,now())',
    [id, residenceId, 'ESPECES', amountMinor],
  );
}
