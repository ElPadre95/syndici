/**
 * LE MUR DE LA MESSAGERIE — tests de fuite (§6, G4), contre un vrai Postgres (PGlite,
 * et Postgres réel sous TEST_DB=pg). Ils échoueraient si un résident pouvait atteindre
 * un fil qui n'est pas le sien, ou une pièce jointe hors de son fil.
 *
 * Scénario : résidences A (mandat actif) et B. Lot A1 (propriétaire + locataire
 * distincts), lot A2 (autre propriétaire), lot B1. Fils : A1-OWNER, A1-TENANT, A2-OWNER,
 * B1-OWNER. Une pièce jointe vit dans A1-OWNER.
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
  canAccessConversation,
  canServeMessageAttachment,
  type CounterpartyRole,
} from './access';
import type { ActiveContext } from '@/server/auth/context';
import type { SqlExecutor } from '@/server/db/sql';

const ids = {
  org: 'org-1',
  rA: 'res-A',
  rB: 'res-B',
  staff: 'p-staff',
  ownerA1: 'p-owner-A1',
  tenantA1: 'p-tenant-A1',
  ownerA2: 'p-owner-A2',
  ownerB1: 'p-owner-B1',
  lotA1: 'lot-A1',
  lotA2: 'lot-A2',
  lotB1: 'lot-B1',
  convA1O: 'conv-A1-owner',
  convA1T: 'conv-A1-tenant',
  convA2O: 'conv-A2-owner',
  convB1O: 'conv-B1-owner',
  fileA1O: 'file-A1-owner',
};

let db: TestDb;
let exec: SqlExecutor;

async function insertConversation(
  d: TestDb,
  id: string,
  residenceId: string,
  lotId: string,
  role: CounterpartyRole,
): Promise<void> {
  await d.query(
    `INSERT INTO "Conversation"(id, "residenceId", "lotId", "counterpartyRole")
     VALUES ($1,$2,$3,$4::"AttachmentRole")`,
    [id, residenceId, lotId, role],
  );
}

async function insertFileAsset(d: TestDb, id: string, residenceId: string): Promise<void> {
  await d.query(
    `INSERT INTO "FileAsset"(id, "residenceId", bucket, "storageKey", "mimeType", "originalName")
     VALUES ($1,$2,'messages',$3,'application/pdf','devis.pdf')`,
    [id, residenceId, `local:${residenceId}/messages/${id}.pdf`],
  );
}

async function insertMessage(
  d: TestDb,
  opts: {
    id: string;
    residenceId: string;
    conversationId: string;
    side: 'GERANT' | 'RESIDENT';
    body: string;
    fileAssetId?: string;
  },
): Promise<void> {
  await d.query(
    `INSERT INTO "Message"(id, "residenceId", "conversationId", "senderSide", body, "fileAssetId")
     VALUES ($1,$2,$3,$4::"MessageSide",$5,$6)`,
    [opts.id, opts.residenceId, opts.conversationId, opts.side, opts.body, opts.fileAssetId ?? null],
  );
}

const ctx = (personId: string, residenceId: string, role: ActiveContext['role']): ActiveContext => ({
  personId,
  residenceId,
  role,
});

beforeAll(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);

  await insertOrganization(db, ids.org);
  await insertResidence(db, ids.rA);
  await insertResidence(db, ids.rB);
  await insertMandate(db, { id: 'm-A', organizationId: ids.org, residenceId: ids.rA });
  await insertMandate(db, { id: 'm-B', organizationId: ids.org, residenceId: ids.rB });

  await insertPerson(db, ids.staff);
  await insertMembership(db, {
    id: 'mem-1',
    organizationId: ids.org,
    personId: ids.staff,
    role: 'MANAGER',
  });

  // Lot A1 : propriétaire + locataire distincts.
  await insertLot(db, ids.lotA1, ids.rA, 'A1');
  await insertPerson(db, ids.ownerA1);
  await insertPerson(db, ids.tenantA1);
  await insertLotAttachment(db, {
    id: 'la-A1-o',
    residenceId: ids.rA,
    lotId: ids.lotA1,
    personId: ids.ownerA1,
    role: 'OWNER',
  });
  await insertLotAttachment(db, {
    id: 'la-A1-t',
    residenceId: ids.rA,
    lotId: ids.lotA1,
    personId: ids.tenantA1,
    role: 'TENANT',
  });

  // Lot A2 : un autre propriétaire (pour prouver qu'un proprio n'atteint pas un autre lot).
  await insertLot(db, ids.lotA2, ids.rA, 'A2');
  await insertPerson(db, ids.ownerA2);
  await insertLotAttachment(db, {
    id: 'la-A2-o',
    residenceId: ids.rA,
    lotId: ids.lotA2,
    personId: ids.ownerA2,
    role: 'OWNER',
  });

  // Lot B1 dans une AUTRE résidence.
  await insertLot(db, ids.lotB1, ids.rB, 'B1');
  await insertPerson(db, ids.ownerB1);
  await insertLotAttachment(db, {
    id: 'la-B1-o',
    residenceId: ids.rB,
    lotId: ids.lotB1,
    personId: ids.ownerB1,
    role: 'OWNER',
  });

  // Fils : A1-OWNER (+ pièce jointe), A1-TENANT, A2-OWNER, B1-OWNER.
  await insertConversation(db, ids.convA1O, ids.rA, ids.lotA1, 'OWNER');
  await insertConversation(db, ids.convA1T, ids.rA, ids.lotA1, 'TENANT');
  await insertConversation(db, ids.convA2O, ids.rA, ids.lotA2, 'OWNER');
  await insertConversation(db, ids.convB1O, ids.rB, ids.lotB1, 'OWNER');

  await insertFileAsset(db, ids.fileA1O, ids.rA);
  await insertMessage(db, {
    id: 'msg-A1O-1',
    residenceId: ids.rA,
    conversationId: ids.convA1O,
    side: 'GERANT',
    body: 'Voici le devis.',
    fileAssetId: ids.fileA1O,
  });
});

describe('le mur — le locataire n\'atteint jamais le fil du propriétaire', () => {
  it('un locataire de A1 n\'accède pas au fil OWNER de son lot (ni son existence)', async () => {
    const t = ctx(ids.tenantA1, ids.rA, 'LOCATAIRE');
    expect(await canAccessConversation(exec, t, ids.convA1O)).toBeNull();
  });

  it('un locataire n\'accède pas à la pièce jointe du fil OWNER de son lot', async () => {
    const t = ctx(ids.tenantA1, ids.rA, 'LOCATAIRE');
    expect(await canServeMessageAttachment(exec, t, ids.fileA1O)).toBe(false);
  });

  it('mais il accède bien à SON fil TENANT', async () => {
    const t = ctx(ids.tenantA1, ids.rA, 'LOCATAIRE');
    const meta = await canAccessConversation(exec, t, ids.convA1T);
    expect(meta?.counterpartyRole).toBe('TENANT');
  });
});

describe('le mur — le propriétaire n\'atteint jamais le fil du locataire', () => {
  it('un propriétaire de A1 n\'accède pas au fil TENANT de son lot', async () => {
    const o = ctx(ids.ownerA1, ids.rA, 'PROPRIETAIRE');
    expect(await canAccessConversation(exec, o, ids.convA1T)).toBeNull();
  });

  it('il accède bien à SON fil OWNER et à sa pièce jointe', async () => {
    const o = ctx(ids.ownerA1, ids.rA, 'PROPRIETAIRE');
    expect((await canAccessConversation(exec, o, ids.convA1O))?.counterpartyRole).toBe('OWNER');
    expect(await canServeMessageAttachment(exec, o, ids.fileA1O)).toBe(true);
  });
});

describe('le mur — un propriétaire n\'atteint aucun fil d\'un lot qui n\'est pas le sien', () => {
  it('le propriétaire de A1 n\'accède pas au fil OWNER de A2', async () => {
    const o = ctx(ids.ownerA1, ids.rA, 'PROPRIETAIRE');
    expect(await canAccessConversation(exec, o, ids.convA2O)).toBeNull();
  });
});

describe('le mur — le syndic voit les deux fils de sa résidence, aucun d\'une autre', () => {
  it('le syndic actif en A voit les fils OWNER et TENANT de A, et A2', async () => {
    const s = ctx(ids.staff, ids.rA, 'GESTIONNAIRE');
    expect(await canAccessConversation(exec, s, ids.convA1O)).not.toBeNull();
    expect(await canAccessConversation(exec, s, ids.convA1T)).not.toBeNull();
    expect(await canAccessConversation(exec, s, ids.convA2O)).not.toBeNull();
    expect(await canServeMessageAttachment(exec, s, ids.fileA1O)).toBe(true);
  });

  it('le syndic actif en A n\'atteint pas un fil de la résidence B', async () => {
    const s = ctx(ids.staff, ids.rA, 'GESTIONNAIRE');
    expect(await canAccessConversation(exec, s, ids.convB1O)).toBeNull();
    // ... mais il l'atteint quand il est actif en B (sélecteur de résidence).
    const sB = ctx(ids.staff, ids.rB, 'GESTIONNAIRE');
    expect(await canAccessConversation(exec, sB, ids.convB1O)).not.toBeNull();
  });
});
