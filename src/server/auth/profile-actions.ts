'use server';

/**
 * Profil du propriétaire (H7). Le propriétaire consulte et modifie SA propre fiche —
 * téléphone, langue préférée, devise secondaire — et son mot de passe. Tout passe par la
 * couche person-access, avec SON PROPRE personId : jamais la fiche d'un autre. Le nom, le
 * lot et le rôle restent au syndic. Le changement de mot de passe exige l'ancien.
 */
import { revalidatePath } from 'next/cache';
import { prismaExecutor } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { updateOwnProfile, getAuthUserIdForSelf } from '@/server/auth/person-access';
import { changePassword, MIN_PASSWORD_LENGTH } from '@/server/auth/password';

const LOCALES = ['fr', 'ar'] as const;
const CURRENCY_RE = /^[A-Z]{3}$/;

export type ProfileResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' };

export async function updateOwnProfileAction(formData: FormData): Promise<ProfileResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE') return { ok: false, error: 'forbidden' };

  const phone = String(formData.get('phone') ?? '').trim() || null;
  const locale = String(formData.get('preferredLocale') ?? '');
  const curRaw = String(formData.get('secondaryCurrency') ?? '').trim().toUpperCase();
  const secondaryCurrency = curRaw === '' ? null : curRaw;
  if (!LOCALES.includes(locale as (typeof LOCALES)[number])) return { ok: false, error: 'invalid' };
  if (secondaryCurrency !== null && !CURRENCY_RE.test(secondaryCurrency)) {
    return { ok: false, error: 'invalid' };
  }

  await updateOwnProfile(prismaExecutor(), ctx.personId, {
    phone,
    preferredLocale: locale,
    secondaryCurrency,
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export type PasswordResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'no_account' | 'wrong_old' | 'weak' };

export async function changeOwnPasswordAction(formData: FormData): Promise<PasswordResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE') return { ok: false, error: 'forbidden' };

  const oldPassword = String(formData.get('oldPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  if (newPassword.length < MIN_PASSWORD_LENGTH) return { ok: false, error: 'weak' };

  // Résout le compte lié à SA fiche (jamais celui d'un autre) via person-access.
  const userId = await getAuthUserIdForSelf(prismaExecutor(), ctx.personId);
  if (!userId) return { ok: false, error: 'no_account' };

  const res = await changePassword(prismaExecutor(), userId, oldPassword, newPassword);
  if (!res.ok) return { ok: false, error: res.reason };
  revalidatePath('/', 'layout');
  return { ok: true };
}
