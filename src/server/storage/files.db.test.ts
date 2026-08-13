/**
 * Isolation multi-résidences des fichiers (C0) — invariant au niveau base. Un fichier
 * appartient à UNE résidence ; `findAccessibleFile` ne le renvoie QUE pour cette
 * résidence. Un contexte scopé sur une autre résidence ne l'atteint jamais. PGlite
 * (gate) ET Postgres réel (`npm run test:pg`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDb, pgliteExecutor, insertResidence, type TestDb } from '@/test/pglite';
import type { SqlExecutor } from '@/server/db/sql';
import { findAccessibleFile } from './files';

let db: TestDb;
let exec: SqlExecutor;
const RES_A = 'res-A';
const RES_B = 'res-B';

async function insertFile(id: string, residenceId: string): Promise<void> {
  await db.query(
    `INSERT INTO "FileAsset" (id,"residenceId",bucket,"storageKey","mimeType","sizeBytes","originalName","createdAt")
     VALUES ($1,$2,'justificatifs',$3,'image/jpeg',1234,'facture.jpg',now())`,
    [id, residenceId, `local:residences/${residenceId}/justificatifs/${id}.jpg`],
  );
}

beforeEach(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);
  await insertResidence(db, RES_A);
  await insertResidence(db, RES_B);
  await insertFile('file-A', RES_A);
  await insertFile('file-B', RES_B);
});

describe('findAccessibleFile (isolation)', () => {
  it('renvoie le fichier dans sa propre résidence', async () => {
    const f = await findAccessibleFile(exec, RES_A, 'file-A');
    expect(f?.id).toBe('file-A');
    expect(f?.residenceId).toBe(RES_A);
    expect(f?.storageKey).toContain('local:');
  });

  it('un contexte d’une AUTRE résidence n’atteint jamais le fichier', async () => {
    expect(await findAccessibleFile(exec, RES_B, 'file-A')).toBeNull();
    expect(await findAccessibleFile(exec, RES_A, 'file-B')).toBeNull();
  });

  it('un identifiant inexistant renvoie null', async () => {
    expect(await findAccessibleFile(exec, RES_A, 'nope')).toBeNull();
  });
});
