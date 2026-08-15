'use server';

/**
 * Actions devise secondaire (H5). Le PROPRIÉTAIRE choisit SA devise (sur sa propre fiche,
 * via person-access) ; le SYNDIC saisit les taux (réglages). Un taux est une donnée de
 * config, jamais un appel externe.
 */
import { revalidatePath } from 'next/cache';
import { prismaExecutor } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { setSecondaryCurrency } from '@/server/auth/person-access';
import { parseMoneyToCentimes } from '@/server/import/normalize';
import { upsertCurrencyRate } from './currency';

const CURRENCY_RE = /^[A-Z]{3}$/;

export type CurrencyResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' };

/** Le propriétaire choisit (ou désactive) sa devise secondaire. Édite SA fiche uniquement. */
export async function setOwnerSecondaryCurrencyAction(formData: FormData): Promise<CurrencyResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE') return { ok: false, error: 'forbidden' };
  const raw = String(formData.get('currency') ?? '').trim().toUpperCase();
  const currency = raw === '' ? null : raw;
  if (currency !== null && !CURRENCY_RE.test(currency)) return { ok: false, error: 'invalid' };
  // person-access : on passe SON PROPRE personId → jamais la fiche d'un tiers.
  await setSecondaryCurrency(prismaExecutor(), ctx.personId, currency);
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Le syndic enregistre un taux indicatif (MAD pour 1 unité de devise) avec sa date. */
export async function upsertCurrencyRateAction(formData: FormData): Promise<CurrencyResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'residence.settings')) {
    return { ok: false, error: 'forbidden' };
  }
  const currency = String(formData.get('currency') ?? '').trim().toUpperCase();
  const madPerUnitMinor = parseMoneyToCentimes(String(formData.get('rate') ?? ''));
  const dateStr = String(formData.get('asOfDate') ?? '').trim();
  const asOfDate = dateStr ? new Date(dateStr) : new Date();
  if (!CURRENCY_RE.test(currency) || madPerUnitMinor === null || madPerUnitMinor <= 0) {
    return { ok: false, error: 'invalid' };
  }
  if (Number.isNaN(asOfDate.getTime())) return { ok: false, error: 'invalid' };

  await upsertCurrencyRate(
    { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role },
    { currency, madPerUnitMinor, asOfDate },
  );
  revalidatePath('/', 'layout');
  return { ok: true };
}
