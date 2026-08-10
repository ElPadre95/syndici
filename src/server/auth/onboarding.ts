/**
 * Onboarding par invitation (§5) — orchestration des briques déjà testées.
 *
 * Deux parcours :
 *   - onboardWithPassword : nouveau compte e-mail+mot de passe, PUIS liaison à la
 *     Person via le code (une fois, irréversible).
 *   - linkExistingAccount : un compte déjà connecté (créé par lien magique) lie
 *     son invitation.
 *
 * Le rattachement compte↔Person passe TOUJOURS par `redeemInvitation` (usage unique,
 * pas de repli e-mail). On ne crée un compte qu'après avoir vérifié le code, et si
 * la liaison échoue on nettoie le compte tout juste créé (pas de compte orphelin).
 */
import type { SqlExecutor, TxRunner } from '@/server/db/sql';
import { redeemInvitation, verifyInvitation, type InvitationFailure } from './invitation';
import { createUserWithPassword, EmailTakenError, MIN_PASSWORD_LENGTH } from './password';
import type { RedeemResult } from './invitation';

export type OnboardFailure = InvitationFailure | 'weak_password' | 'email_taken';

export type OnboardResult =
  { ok: true; userId: string; result: RedeemResult } | { ok: false; reason: OnboardFailure };

export async function onboardWithPassword(
  exec: SqlExecutor,
  runner: TxRunner,
  params: { code: string; email: string; password: string; now?: Date },
): Promise<OnboardResult> {
  const now = params.now ?? new Date();
  if (params.password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: 'weak_password' };

  // 1. Vérifier le code sans le consommer (aucun compte créé si invalide).
  const check = await verifyInvitation(exec, params.code, now);
  if (!check.valid) return { ok: false, reason: check.reason };

  // 2. Créer le compte (insertion seule).
  let userId: string;
  try {
    userId = await createUserWithPassword(exec, params.email, params.password);
  } catch (e) {
    if (e instanceof EmailTakenError) return { ok: false, reason: 'email_taken' };
    throw e;
  }

  // 3. Lier le compte à la Person via le code (usage unique, transactionnel).
  const redeemed = await redeemInvitation(runner, { code: params.code, authUserId: userId, now });
  if (!redeemed.ok) {
    // Course perdue (code consommé entre-temps) : supprimer le compte orphelin.
    await exec.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
    return { ok: false, reason: redeemed.reason };
  }
  return { ok: true, userId, result: redeemed.result };
}

/** Lie une invitation à un compte DÉJÀ connecté (parcours lien magique). */
export async function linkExistingAccount(
  runner: TxRunner,
  params: { code: string; authUserId: string; now?: Date },
): Promise<{ ok: true; result: RedeemResult } | { ok: false; reason: InvitationFailure }> {
  return redeemInvitation(runner, params);
}
