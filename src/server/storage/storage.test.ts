/**
 * Cœur PUR du stockage (C0) : validation type/taille, construction de clé (scope
 * résidence + anti-traversée), signature d'URL (validité/altération/expiration), et
 * aller-retour du driver local (écriture → relecture → suppression).
 */
import { describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateUpload, MAX_UPLOAD_BYTES } from './validation';
import { storageKeyFor } from './keys';
import { signFileToken, verifyFileToken } from './sign';
import { localDiskDriver } from './drivers/local';

const SECRET = 'test-secret-key';

describe('validateUpload', () => {
  it('accepte les images et le PDF, renvoie l’extension', () => {
    expect(validateUpload({ mimeType: 'image/jpeg', sizeBytes: 1000 })).toEqual({
      ok: true,
      ext: 'jpg',
    });
    expect(validateUpload({ mimeType: 'application/pdf', sizeBytes: 1000 })).toEqual({
      ok: true,
      ext: 'pdf',
    });
    expect(validateUpload({ mimeType: 'IMAGE/PNG', sizeBytes: 1 }).ok).toBe(true); // insensible à la casse
  });

  it('refuse un type non supporté, un fichier vide, un fichier trop gros', () => {
    expect(validateUpload({ mimeType: 'application/x-msdownload', sizeBytes: 10 })).toEqual({
      ok: false,
      error: 'unsupported_type',
    });
    expect(validateUpload({ mimeType: 'image/png', sizeBytes: 0 })).toEqual({
      ok: false,
      error: 'empty',
    });
    expect(validateUpload({ mimeType: 'image/png', sizeBytes: MAX_UPLOAD_BYTES + 1 })).toEqual({
      ok: false,
      error: 'too_large',
    });
  });
});

describe('storageKeyFor', () => {
  it('porte la résidence et assainit les segments (aucune traversée)', () => {
    const key = storageKeyFor('res-1', 'justificatifs', 'file-9', 'jpg');
    expect(key).toBe('residences/res-1/justificatifs/file-9.jpg');
    // une tentative de traversée est neutralisée
    expect(storageKeyFor('../../etc', 'b', 'f', 'jpg')).toBe('residences/etc/b/f.jpg');
  });
});

describe('signFileToken / verifyFileToken', () => {
  it('valide une signature fraîche, rejette une altérée ou expirée', () => {
    const exp = 2000;
    const sig = signFileToken('file-1', exp, SECRET);
    expect(verifyFileToken('file-1', exp, sig, 1000, SECRET)).toBe(true); // now < exp
    expect(verifyFileToken('file-1', exp, sig, 2500, SECRET)).toBe(false); // expiré
    expect(verifyFileToken('file-2', exp, sig, 1000, SECRET)).toBe(false); // autre fichier
    expect(verifyFileToken('file-1', exp, 'deadbeef', 1000, SECRET)).toBe(false); // signature bidon
    expect(verifyFileToken('file-1', exp, sig, 1000, 'autre-secret')).toBe(false); // autre secret
  });
});

describe('localDiskDriver', () => {
  it('écrit, relit à l’identique, puis supprime', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'syndici-storage-'));
    const driver = localDiskDriver(dir);
    const body = Buffer.from('facture RADEEMA — 184,00 MAD');
    const ref = await driver.put('residences/r1/justificatifs/f1.jpg', body, 'image/jpeg');
    expect(ref).toBe('residences/r1/justificatifs/f1.jpg');
    expect((await driver.get(ref))?.toString()).toBe(body.toString());
    await driver.delete(ref);
    expect(await driver.get(ref)).toBeNull();
  });

  it('refuse une référence qui sort de la racine', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'syndici-storage-'));
    const driver = localDiskDriver(dir);
    await expect(driver.put('../evade.txt', Buffer.from('x'), 'text/plain')).rejects.toThrow();
  });
});
