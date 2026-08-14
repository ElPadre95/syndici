/**
 * Relances (E2). Cœur pur (lien wa.me, numéro) + invariant base : `writeReminder` trace
 * la relance avec son TEXTE et le canal WhatsApp (PGlite ET Postgres réel). C'est cette
 * trace qui sert de preuve et alimente l'anti-harcèlement.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  freshDb,
  pgliteExecutor,
  pgliteTxRunner,
  insertResidence,
  insertLot,
  type TestDb,
} from '@/test/pglite';
import type { SqlExecutor, TxRunner } from '@/server/db/sql';
import { writeReminder, waPhoneDigits, waLink } from './reminders';

describe('waPhoneDigits / waLink (pur)', () => {
  it('normalise un numéro international en chiffres', () => {
    expect(waPhoneDigits('+212 6 61 00 00 00')).toBe('212661000000');
    expect(waPhoneDigits('+33 6 12 34 56 78')).toBe('33612345678');
    expect(waPhoneDigits(null)).toBeNull();
    expect(waPhoneDigits('123')).toBeNull(); // trop court
  });

  it('construit un lien wa.me pré-rempli (destinataire optionnel)', () => {
    expect(waLink('212661000000', 'Bonjour')).toBe('https://wa.me/212661000000?text=Bonjour');
    expect(waLink(null, 'a b')).toBe('https://wa.me/?text=a%20b');
  });
});

describe('writeReminder', () => {
  let db: TestDb;
  let exec: SqlExecutor;
  let runner: TxRunner;
  const RES = 'res-1';

  beforeEach(async () => {
    db = await freshDb();
    exec = pgliteExecutor(db);
    runner = pgliteTxRunner(db);
    await insertResidence(db, RES);
    await insertLot(db, 'lot-1', RES, 'A1');
  });

  it('trace la relance avec le texte et le canal WhatsApp', async () => {
    const id = await writeReminder(runner, {
      residenceId: RES,
      lotId: 'lot-1',
      recipientPersonId: null,
      reminderRuleId: null,
      message: 'Bonjour, montant dû : 650,00 MAD',
      sentByPersonId: 'gerant',
    });
    const rows = await exec.query<{ channel: string; message: string; sentByPersonId: string }>(
      `SELECT channel, message, "sentByPersonId" FROM "Reminder" WHERE id = $1`,
      [id],
    );
    expect(rows[0]).toEqual({
      channel: 'WHATSAPP',
      message: 'Bonjour, montant dû : 650,00 MAD',
      sentByPersonId: 'gerant',
    });
  });
});
