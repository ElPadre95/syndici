/**
 * MUR DES DOCUMENTS (H6) — tests de fuite au niveau du FICHIER, PGlite + Postgres réel.
 * Un document PRIVÉ n'est JAMAIS servi à un autre, syndic compris. C'est la promesse faite
 * à l'utilisateur au moment du dépôt ; on la teste sur le fichier, pas seulement la ligne.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { TestDb } from '@/test/pglite';
import { freshDb, pgliteExecutor, insertResidence, insertPerson } from '@/test/pglite';
import { canServeDocument } from './data';
import type { ActiveContext } from '@/server/auth/context';
import type { SqlExecutor } from '@/server/db/sql';

const ids = {
  rA: 'res-A',
  ownerA: 'p-owner-A',
  ownerB: 'p-owner-B',
  staff: 'p-staff',
  filePrive: 'file-prive-A',
  filePartage: 'file-partage-A',
  fileResidence: 'file-residence',
};

let db: TestDb;
let exec: SqlExecutor;

async function insertFile(d: TestDb, id: string, uploader: string | null): Promise<void> {
  await d.query(
    `INSERT INTO "FileAsset"(id,"residenceId",bucket,"storageKey","mimeType","originalName","uploadedByPersonId")
     VALUES ($1,'res-A','documents',$2,'application/pdf','doc.pdf',$3)`,
    [id, `local:res-A/documents/${id}.pdf`, uploader],
  );
}
async function insertDoc(d: TestDb, id: string, fileId: string, scope: string): Promise<void> {
  await d.query(
    `INSERT INTO "Document"(id,"residenceId","fileAssetId",name,type,scope,origin)
     VALUES ($1,'res-A',$2,'Titre','AUTRE'::"DocumentType",$3::"DocumentScope",'RESIDENT'::"DocumentOrigin")`,
    [id, fileId, scope],
  );
}
const ctx = (personId: string, role: ActiveContext['role']): ActiveContext => ({
  personId,
  residenceId: ids.rA,
  role,
});

beforeAll(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);
  await insertResidence(db, ids.rA);
  await insertPerson(db, ids.ownerA);
  await insertPerson(db, ids.ownerB);
  await insertPerson(db, ids.staff);
  await insertFile(db, ids.filePrive, ids.ownerA);
  await insertFile(db, ids.filePartage, ids.ownerA);
  await insertFile(db, ids.fileResidence, ids.staff);
  await insertDoc(db, 'doc-prive', ids.filePrive, 'PRIVE');
  await insertDoc(db, 'doc-partage', ids.filePartage, 'PARTAGE');
  await insertDoc(db, 'doc-residence', ids.fileResidence, 'RESIDENCE');
});

describe('le mur — un document PRIVÉ n\'est servi qu\'à son déposant', () => {
  it('le fichier privé du propriétaire A : servi à A, JAMAIS au syndic ni à un autre proprio', async () => {
    expect(await canServeDocument(exec, ctx(ids.ownerA, 'PROPRIETAIRE'), ids.filePrive)).toBe(true);
    expect(await canServeDocument(exec, ctx(ids.staff, 'GESTIONNAIRE'), ids.filePrive)).toBe(false);
    expect(await canServeDocument(exec, ctx(ids.staff, 'SYNDIC'), ids.filePrive)).toBe(false);
    expect(await canServeDocument(exec, ctx(ids.ownerB, 'PROPRIETAIRE'), ids.filePrive)).toBe(false);
  });
});

describe('le mur — PARTAGE : le déposant ET le syndic, jamais un autre résident', () => {
  it('le fichier partagé de A : servi à A et au syndic, pas à un autre proprio', async () => {
    expect(await canServeDocument(exec, ctx(ids.ownerA, 'PROPRIETAIRE'), ids.filePartage)).toBe(true);
    expect(await canServeDocument(exec, ctx(ids.staff, 'SYNDIC'), ids.filePartage)).toBe(true);
    expect(await canServeDocument(exec, ctx(ids.ownerB, 'PROPRIETAIRE'), ids.filePartage)).toBe(false);
  });
});

describe('RESIDENCE : visible de toute la résidence', () => {
  it('servi à tous', async () => {
    expect(await canServeDocument(exec, ctx(ids.ownerA, 'PROPRIETAIRE'), ids.fileResidence)).toBe(true);
    expect(await canServeDocument(exec, ctx(ids.ownerB, 'PROPRIETAIRE'), ids.fileResidence)).toBe(true);
    expect(await canServeDocument(exec, ctx(ids.staff, 'SYNDIC'), ids.fileResidence)).toBe(true);
  });
});

describe('fail-closed', () => {
  it('un fichier sans document (ou inconnu) n\'est jamais servi', async () => {
    expect(await canServeDocument(exec, ctx(ids.staff, 'SYNDIC'), 'nope')).toBe(false);
  });
});
