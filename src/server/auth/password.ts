/**
 * Authentification par mot de passe (§1) — logique isolée et testable.
 *
 * Le hachage (bcrypt) et la vérification vivent ici, séparés du provider Auth.js,
 * pour être testés contre un vrai Postgres (PGlite) sans démarrer NextAuth. Le
 * compte (`User`) est distinct de la `Person` métier : ce module ne touche que
 * `User` (jamais `Person` — cf. test méta).
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '@/server/db/sql';

export const MIN_PASSWORD_LENGTH = 10;
const BCRYPT_ROUNDS = 12;

export class WeakPasswordError extends Error {
  constructor() {
    super(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères`);
    this.name = 'WeakPasswordError';
  }
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new WeakPasswordError();
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Identité minimale renvoyée à Auth.js après vérification réussie. */
export interface AuthedUser {
  id: string;
  email: string | null;
}

/**
 * Vérifie un couple e-mail/mot de passe. Renvoie `null` (jamais d'erreur
 * distinctive) si l'e-mail est inconnu, le compte n'a pas de mot de passe, ou le
 * mot de passe est trop court/incorrect — aucune fuite permettant d'énumérer les
 * comptes.
 */
export async function authenticatePassword(
  exec: SqlExecutor,
  email: string,
  password: string,
): Promise<AuthedUser | null> {
  if (password.length < MIN_PASSWORD_LENGTH) return null;
  const rows = await exec.query<{ id: string; email: string | null; passwordHash: string | null }>(
    `SELECT id, email, "passwordHash" FROM "User" WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()],
  );
  const user = rows[0];
  if (!user?.passwordHash) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;
  return { id: user.id, email: user.email };
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: 'wrong_old' | 'weak' | 'no_account' };

/**
 * Change le mot de passe d'un compte APRÈS vérification de l'ancien (jamais sans). Ne
 * touche que `User`. L'appelant fournit le `userId` de SA propre session — un propriétaire
 * ne change jamais le mot de passe d'un autre.
 */
export async function changePassword(
  exec: SqlExecutor,
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const rows = await exec.query<{ passwordHash: string | null }>(
    `SELECT "passwordHash" FROM "User" WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const user = rows[0];
  if (!user?.passwordHash) return { ok: false, reason: 'no_account' };
  if (!(await bcrypt.compare(oldPassword, user.passwordHash))) return { ok: false, reason: 'wrong_old' };
  if (newPassword.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: 'weak' };
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await exec.query(`UPDATE "User" SET "passwordHash" = $1 WHERE id = $2`, [hash, userId]);
  return { ok: true };
}

export class EmailTakenError extends Error {
  constructor() {
    super('Un compte existe déjà pour cet e-mail');
    this.name = 'EmailTakenError';
  }
}

/**
 * Crée un NOUVEAU compte avec mot de passe. Insertion seule : on ne remplace
 * JAMAIS le mot de passe d'un compte existant (sinon un code d'invitation
 * permettrait d'écraser le mot de passe d'un compte déjà créé par lien magique —
 * vecteur de reprise de compte). Si l'e-mail est déjà pris, lève `EmailTakenError` :
 * l'utilisateur doit se connecter puis lier son invitation depuis son compte.
 */
export async function createUserWithPassword(
  exec: SqlExecutor,
  email: string,
  password: string,
): Promise<string> {
  const hash = await hashPassword(password);
  const normalized = email.toLowerCase();
  const existing = await exec.query<{ id: string }>(
    `SELECT id FROM "User" WHERE email = $1 LIMIT 1`,
    [normalized],
  );
  if (existing[0]) throw new EmailTakenError();
  const id = randomUUID();
  await exec.query(`INSERT INTO "User"(id, email, "passwordHash") VALUES ($1, $2, $3)`, [
    id,
    normalized,
    hash,
  ]);
  return id;
}
