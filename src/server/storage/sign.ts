/**
 * URL signée à durée limitée (C0). Un fichier n'est JAMAIS servi par une URL de
 * fournisseur : le navigateur ne reçoit qu'un lien vers `/api/files/<id>` portant
 * une signature HMAC (secret = `AUTH_SECRET`) et une expiration. La route vérifie la
 * signature ET revalide le scope résidence de la session (double garde). Le secret
 * ne quitte jamais le serveur.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

function signingSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET manquant : impossible de signer les URLs de fichiers.');
  return s;
}

/** Signature HMAC-SHA256 de `<fileId>.<exp>`. PURE (secret injectable pour les tests). */
export function signFileToken(
  fileId: string,
  expEpochSec: number,
  secret = signingSecret(),
): string {
  return createHmac('sha256', secret).update(`${fileId}.${expEpochSec}`).digest('hex');
}

/** Vérifie signature + non-expiration (comparaison à temps constant). PURE. */
export function verifyFileToken(
  fileId: string,
  expEpochSec: number,
  sig: string,
  nowEpochSec: number,
  secret = signingSecret(),
): boolean {
  if (!Number.isFinite(expEpochSec) || expEpochSec < nowEpochSec) return false;
  const expected = signFileToken(fileId, expEpochSec, secret);
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(sig, 'hex');
    b = Buffer.from(expected, 'hex');
  } catch {
    return false;
  }
  return a.length === b.length && timingSafeEqual(a, b);
}

const DEFAULT_TTL_SEC = 300; // 5 min : assez pour afficher/ouvrir, trop court pour partager

/** Chemin signé et expirant vers la route de service (appelé APRÈS contrôle de droit). */
export function signedFilePath(
  fileId: string,
  ttlSec: number = DEFAULT_TTL_SEC,
  nowEpochSec: number = Math.floor(Date.now() / 1000),
): string {
  const exp = nowEpochSec + ttlSec;
  return `/api/files/${fileId}?exp=${exp}&sig=${signFileToken(fileId, exp)}`;
}
