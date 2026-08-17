/**
 * MUR DES CHANTIERS (I7) — étanchéité du service des fichiers. Le staff voit les devis/photos
 * de tout chantier ; un propriétaire ne voit QUE ceux des chantiers PARTAGE — jamais un chantier
 * INTERNE. Vérifié sur PGlite ET Postgres réel.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { freshDb, pgliteExecutor, insertResidence, type TestDb } from '@/test/pglite';
import type { SqlExecutor } from '@/server/db/sql';
import { canServeWorksFile } from './access';

let db: TestDb;
let exec: SqlExecutor;
const RES = 'res-1';

async function insertFile(id: string): Promise<void> {
  await db.query(
    `INSERT INTO "FileAsset"(id,"residenceId",bucket,"storageKey") VALUES ($1,$2,'travaux',$3)`,
    [id, RES, `local:${id}`],
  );
}
async function insertProject(id: string, visibility: 'PARTAGE' | 'INTERNE'): Promise<void> {
  await db.query(
    `INSERT INTO "WorksProject"(id,"residenceId",title,description,status,visibility,"updatedAt")
     VALUES ($1,$2,'T','D','CONSULTATION'::"WorksStatus",$3::"ExpenseVisibility",now())`,
    [id, RES, visibility],
  );
}
async function insertQuote(id: string, projectId: string, fileId: string): Promise<void> {
  await db.query(
    `INSERT INTO "WorksQuote"(id,"residenceId","projectId","supplierName","amountMinor","receivedOn","fileAssetId")
     VALUES ($1,$2,$3,'S',1000,CURRENT_DATE,$4)`,
    [id, RES, projectId, fileId],
  );
}
async function insertPhoto(id: string, projectId: string, fileId: string): Promise<void> {
  await db.query(
    `INSERT INTO "WorksPhoto"(id,"residenceId","projectId","fileAssetId",phase)
     VALUES ($1,$2,$3,$4,'AVANT'::"WorksPhase")`,
    [id, RES, projectId, fileId],
  );
}

const staff = { personId: 'p-staff', residenceId: RES, role: 'SYNDIC' as const };
const owner = { personId: 'p-owner', residenceId: RES, role: 'PROPRIETAIRE' as const };

beforeAll(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);
  await insertResidence(db, RES);
  await insertFile('f-shared-quote');
  await insertFile('f-shared-photo');
  await insertFile('f-internal-quote');
  await insertProject('proj-shared', 'PARTAGE');
  await insertProject('proj-internal', 'INTERNE');
  await insertQuote('q-shared', 'proj-shared', 'f-shared-quote');
  await insertPhoto('ph-shared', 'proj-shared', 'f-shared-photo');
  await insertQuote('q-internal', 'proj-internal', 'f-internal-quote');
});

describe('canServeWorksFile', () => {
  it('le staff voit les fichiers de tout chantier (PARTAGE et INTERNE)', async () => {
    expect(await canServeWorksFile(exec, staff, 'f-shared-quote')).toBe(true);
    expect(await canServeWorksFile(exec, staff, 'f-shared-photo')).toBe(true);
    expect(await canServeWorksFile(exec, staff, 'f-internal-quote')).toBe(true);
  });

  it('le propriétaire voit les fichiers PARTAGE, JAMAIS un chantier INTERNE', async () => {
    expect(await canServeWorksFile(exec, owner, 'f-shared-quote')).toBe(true);
    expect(await canServeWorksFile(exec, owner, 'f-shared-photo')).toBe(true);
    expect(await canServeWorksFile(exec, owner, 'f-internal-quote')).toBe(false); // mur
  });

  it('un fichier inconnu n’est jamais servi', async () => {
    expect(await canServeWorksFile(exec, staff, 'nope')).toBe(false);
    expect(await canServeWorksFile(exec, owner, 'nope')).toBe(false);
  });
});
