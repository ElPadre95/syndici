/**
 * Invitation par code d'accès (§5) — corrige les failles du prototype (C1/C4/C5).
 *
 * Principes :
 *   - Code aléatoire ≥ 10 caractères, alphabet sans caractères ambigus (ni 0/O,
 *     ni I/L/1), tiré de `crypto.randomInt` (≈ 5 bits d'entropie/caractère).
 *   - On ne stocke JAMAIS le code en clair : seulement son SHA-256 (`codeHash`).
 *   - Usage UNIQUE, expiration 30 jours, nombre d'essais borné.
 *   - Le rattachement compte↔personne se fait UNE seule fois, IRRÉVERSIBLEMENT,
 *     via `linkAuthAccount` (UPDATE conditionnel). AUCUN repli e-mail — c'était la
 *     faille de reprise de compte du prototype.
 *   - La vérification n'expose aucune PII (au plus un e-mail masqué).
 *
 * Ce module ne touche jamais directement le modèle des personnes : l'écriture
 * (`linkAuthAccount`) et la lecture masquée passent par `person-access.ts`.
 */
import { createHash, randomInt } from 'node:crypto';
import type { SqlExecutor, TxRunner } from '@/server/db/sql';
import { getMaskedInvitationContact, linkAuthAccount } from './person-access';

/** Alphabet sans ambiguïté : ni 0/O, ni 1/I/L. 31 symboles. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 12; // ≥ 10 exigé ; 12 ⇒ ~59 bits d'entropie
export const MAX_ATTEMPTS = 5;
export const EXPIRY_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Rôle porté par l'invitation (aligné sur AttachmentRole). */
export type InvitationRole = 'OWNER' | 'TENANT';

/** Génère un code d'accès lisible, à afficher UNE fois puis oublier. */
export function generateAccessCode(length: number = CODE_LENGTH): string {
  if (length < 10) throw new RangeError('Le code doit faire au moins 10 caractères');
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** Normalise un code saisi (majuscules, on retire tout ce qui n'est pas de l'alphabet). */
export function normalizeCode(raw: string): string {
  const up = raw.toUpperCase();
  let out = '';
  for (const ch of up) if (CODE_ALPHABET.includes(ch)) out += ch;
  return out;
}

/** Hash de stockage/lookup — SHA-256 hex du code normalisé. */
export function hashCode(code: string): string {
  return createHash('sha256').update(normalizeCode(code)).digest('hex');
}

export interface CreateInvitationInput {
  residenceId: string;
  lotId: string;
  personId: string;
  role: InvitationRole;
  createdByPersonId?: string;
  now?: Date;
}

/**
 * Émet une invitation et renvoie le code EN CLAIR une seule fois (jamais restocké).
 * L'appelant (UI staff) est responsable de le transmettre au résident.
 */
export async function createInvitation(
  exec: SqlExecutor,
  input: CreateInvitationInput,
): Promise<{ id: string; code: string; expiresAt: Date }> {
  const now = input.now ?? new Date();
  const code = generateAccessCode();
  const expiresAt = new Date(now.getTime() + EXPIRY_DAYS * MS_PER_DAY);
  const rows = await exec.query<{ id: string }>(
    `INSERT INTO "InvitationCode"
       ("id","residenceId","lotId","personId",role,"codeHash",status,"attemptCount","expiresAt","createdByPersonId","createdAt")
     VALUES (gen_random_uuid(),$1,$2,$3,$4::"AttachmentRole",$5,'PENDING',0,$6,$7,$8)
     RETURNING id`,
    [
      input.residenceId,
      input.lotId,
      input.personId,
      input.role,
      hashCode(code),
      expiresAt.toISOString(),
      input.createdByPersonId ?? null,
      now.toISOString(),
    ],
  );
  return { id: rows[0]!.id, code, expiresAt };
}

/** Motifs d'échec — jamais de PII, jamais « ce code existe mais… » exploitable. */
export type InvitationFailure =
  | 'invalid'
  | 'already_used'
  | 'revoked'
  | 'expired'
  | 'too_many_attempts'
  | 'person_already_linked';

/**
 * Vérifie un code SANS le consommer, pour l'écran de saisie. Ne renvoie que la
 * validité et, au plus, un e-mail masqué — jamais le nom, jamais l'e-mail complet,
 * jamais de préremplissage.
 */
export async function verifyInvitation(
  exec: SqlExecutor,
  code: string,
  now: Date = new Date(),
): Promise<
  | { valid: true; role: InvitationRole; maskedEmail: string | null }
  | { valid: false; reason: InvitationFailure }
> {
  const rows = await exec.query<{
    personId: string;
    role: InvitationRole;
    status: string;
    attemptCount: number;
    expiresAt: string | Date | null;
  }>(
    `SELECT "personId", role, status, "attemptCount", "expiresAt"
       FROM "InvitationCode" WHERE "codeHash" = $1 LIMIT 1`,
    [hashCode(code)],
  );
  const inv = rows[0];
  if (!inv) return { valid: false, reason: 'invalid' };
  if (inv.status === 'USED') return { valid: false, reason: 'already_used' };
  if (inv.status === 'REVOKED') return { valid: false, reason: 'revoked' };
  if (inv.attemptCount >= MAX_ATTEMPTS) return { valid: false, reason: 'too_many_attempts' };
  if (inv.status === 'EXPIRED' || (inv.expiresAt && new Date(inv.expiresAt) < now))
    return { valid: false, reason: 'expired' };
  const { maskedEmail } = await getMaskedInvitationContact(exec, inv.personId);
  return { valid: true, role: inv.role, maskedEmail };
}

export interface RedeemResult {
  personId: string;
  residenceId: string;
  lotId: string;
  role: InvitationRole;
}

/**
 * Consomme une invitation et lie le compte à la personne, de façon ATOMIQUE et à
 * USAGE UNIQUE. Toute la séquence (verrou de l'invitation, lien du compte, passage
 * à USED) est dans une transaction : un ROLLBACK ne consomme rien. Le verrou
 * `FOR UPDATE` + le passage à USED garantissent qu'un second appel concurrent
 * échoue (`already_used`).
 */
export async function redeemInvitation(
  runner: TxRunner,
  params: { code: string; authUserId: string; now?: Date },
): Promise<{ ok: true; result: RedeemResult } | { ok: false; reason: InvitationFailure }> {
  const now = params.now ?? new Date();
  const codeHash = hashCode(params.code);
  return runner.transaction(async (tx) => {
    const rows = await tx.query<{
      id: string;
      personId: string;
      residenceId: string;
      lotId: string;
      role: InvitationRole;
      status: string;
      attemptCount: number;
      expiresAt: string | Date | null;
    }>(
      `SELECT id, "personId", "residenceId", "lotId", role, status, "attemptCount", "expiresAt"
         FROM "InvitationCode" WHERE "codeHash" = $1 FOR UPDATE`,
      [codeHash],
    );
    const inv = rows[0];
    if (!inv) return { ok: false as const, reason: 'invalid' as const };
    if (inv.status === 'USED') return { ok: false as const, reason: 'already_used' as const };
    if (inv.status === 'REVOKED') return { ok: false as const, reason: 'revoked' as const };
    if (inv.attemptCount >= MAX_ATTEMPTS)
      return { ok: false as const, reason: 'too_many_attempts' as const };
    if (inv.status === 'EXPIRED' || (inv.expiresAt && new Date(inv.expiresAt) < now)) {
      await tx.query(`UPDATE "InvitationCode" SET status = 'EXPIRED' WHERE id = $1`, [inv.id]);
      return { ok: false as const, reason: 'expired' as const };
    }

    // Rattachement compte↔personne : une seule fois, irréversible, sans repli e-mail.
    const linked = await linkAuthAccount(tx, inv.personId, params.authUserId);
    if (!linked) {
      await tx.query(
        `UPDATE "InvitationCode" SET "attemptCount" = "attemptCount" + 1 WHERE id = $1`,
        [inv.id],
      );
      return { ok: false as const, reason: 'person_already_linked' as const };
    }

    await tx.query(`UPDATE "InvitationCode" SET status = 'USED', "usedAt" = $2 WHERE id = $1`, [
      inv.id,
      now.toISOString(),
    ]);
    return {
      ok: true as const,
      result: {
        personId: inv.personId,
        residenceId: inv.residenceId,
        lotId: inv.lotId,
        role: inv.role,
      },
    };
  });
}
