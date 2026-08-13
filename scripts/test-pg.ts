/**
 * Lance les tests d'invariants DB contre un Postgres RÉEL (pas PGlite), en une commande :
 *
 *     npm run test:pg
 *
 * Pourquoi : PGlite est tolérant là où Postgres ne l'est pas (ex. un paramètre `text`
 * affecté à une colonne `timestamp`/`enum`/`int` sans cast explicite). Un test vert
 * sur PGlite pouvait donc masquer une fonction cassée en production. Cette commande
 * rejoue les MÊMES tests (ceux qui utilisent `freshDb`) sur un vrai serveur Postgres,
 * via un client Prisma dédié qui reproduit le binding de paramètres de la production.
 *
 * Elle : (1) déduit une base de test jetable depuis DATABASE_URL (`<base>_test`),
 * (2) la crée si besoin, (3) applique les migrations, (4) lance vitest avec TEST_DB=pg
 * en mono-worker (les tests tronquent les tables entre eux ; pas de course).
 *
 * Pré-requis : un Postgres accessible via DATABASE_URL (le serveur de dev suffit) et
 * un rôle ayant le droit CREATEDB. Rien d'autre à installer.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Repli : lire .env (le script tsx ne charge pas dotenv automatiquement).
  for (const f of ['.env.local', '.env']) {
    try {
      const m = readFileSync(join(process.cwd(), f), 'utf8').match(/^DATABASE_URL="?([^"\n]+)"?/m);
      if (m) return m[1]!;
    } catch {
      // fichier absent : on continue
    }
  }
  throw new Error('DATABASE_URL introuvable (ni en env, ni dans .env/.env.local).');
}

function withDatabase(url: string, dbName: string): string {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  return u.toString();
}

function testFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.test\.ts$/.test(name) && readFileSync(p, 'utf8').includes('freshDb')) out.push(p);
    }
  };
  walk(join(process.cwd(), 'src'));
  return out.sort();
}

async function main(): Promise<void> {
  const baseUrl = loadDatabaseUrl();
  const baseName = new URL(baseUrl).pathname.replace(/^\//, '') || 'syndici';
  const testName = process.env.TEST_DB_NAME ?? `${baseName}_test`;
  const testUrl = process.env.TEST_DATABASE_URL ?? withDatabase(baseUrl, testName);
  const adminUrl = withDatabase(baseUrl, 'postgres');

  // 1. Créer la base de test si elle n'existe pas (CREATE DATABASE hors transaction).
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    const exists = await admin.$queryRawUnsafe<Array<{ one: number }>>(
      `SELECT 1 AS one FROM pg_database WHERE datname = $1`,
      testName,
    );
    if (exists.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${testName}"`);
      console.log(`• base de test créée : ${testName}`);
    } else {
      console.log(`• base de test présente : ${testName}`);
    }
  } finally {
    await admin.$disconnect();
  }

  // 2. Appliquer les migrations sur la base de test.
  //    `prisma migrate` se connecte via `directUrl` (DIRECT_URL) et non `url`
  //    (DATABASE_URL) ; il faut donc surcharger LES DEUX, sinon les migrations
  //    partent sur la base de dev (celle de .env) et la base de test reste en retard.
  console.log('• migrate deploy sur la base de test…');
  const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl },
  });
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);

  // 3. Lancer vitest contre le Postgres réel, en mono-worker (isolation par TRUNCATE).
  const files = testFiles();
  console.log(`• vitest (Postgres réel) sur ${files.length} fichiers d'invariants…`);
  const vitest = spawnSync('npx', ['vitest', 'run', '--no-file-parallelism', ...files], {
    stdio: 'inherit',
    env: { ...process.env, TEST_DB: 'pg', TEST_DATABASE_URL: testUrl },
  });
  process.exit(vitest.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
