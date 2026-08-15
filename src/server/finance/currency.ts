/**
 * Devise secondaire (H5) — conversion INDICATIVE. Le taux est une DONNÉE de configuration
 * (saisie par le syndic, avec sa date), jamais un appel à un service externe. On n'affiche
 * qu'une estimation à côté des dirhams, dans l'espace du propriétaire ; les montants réels
 * restent en MAD. Extensible : plusieurs devises peuvent coexister par résidence.
 */
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor } from '@/server/db/sql';
import { getSecondaryCurrency } from '@/server/auth/person-access';
import type { ActiveContext } from '@/server/auth/context';

/**
 * Convertit un montant en centimes de dirham vers la devise secondaire (unités entières
 * décimales). PURE. `madPerUnitMinor` = centimes MAD pour 1 unité de la devise.
 */
export function convertMinor(minorMad: number, madPerUnitMinor: number): number {
  if (madPerUnitMinor <= 0) return 0;
  return minorMad / madPerUnitMinor;
}

export interface CurrencyRateView {
  currency: string;
  madPerUnitMinor: number;
  asOfDate: string;
}

/** Taux de change configurés pour la résidence (le propriétaire les consulte pour choisir). */
export async function listCurrencyRates(ctx: ActiveContext): Promise<CurrencyRateView[]> {
  const rows = await forResidence(ctx.residenceId).currencyRate.findMany({
    orderBy: { currency: 'asc' },
    select: { currency: true, madPerUnitMinor: true, asOfDate: true },
  });
  return rows.map((r) => ({
    currency: r.currency,
    madPerUnitMinor: r.madPerUnitMinor,
    asOfDate: r.asOfDate.toISOString(),
  }));
}

/** Enregistre / met à jour un taux (syndic). Trace un audit. */
export async function upsertCurrencyRate(
  ctx: ActiveContext,
  input: { currency: string; madPerUnitMinor: number; asOfDate: Date },
): Promise<void> {
  const scoped = forResidence(ctx.residenceId);
  const existing = await scoped.currencyRate.findFirst({
    where: { currency: input.currency },
    select: { id: true },
  });
  if (existing) {
    await scoped.currencyRate.update({
      where: { id: existing.id },
      data: { madPerUnitMinor: input.madPerUnitMinor, asOfDate: input.asOfDate },
    });
  } else {
    await scoped.currencyRate.create({
      data: {
        residenceId: ctx.residenceId,
        currency: input.currency,
        madPerUnitMinor: input.madPerUnitMinor,
        asOfDate: input.asOfDate,
      },
    });
  }
  await scoped.auditLog.create({
    data: {
      residenceId: ctx.residenceId,
      actorPersonId: ctx.personId,
      action: 'currency.rate',
      entityType: 'CurrencyRate',
      entityId: input.currency,
      after: { madPerUnitMinor: input.madPerUnitMinor, asOfDate: input.asOfDate.toISOString() },
    },
  });
}

export interface ResolvedRate {
  currency: string;
  madPerUnitMinor: number;
  asOfDate: string;
}

/**
 * Taux applicable au propriétaire : SA devise choisie (`Person.secondaryCurrency`) croisée
 * avec le taux configuré dans SA résidence. `null` si désactivée ou si aucun taux — dans ce
 * cas aucune conversion n'est affichée.
 */
export async function resolveSecondaryRate(ctx: ActiveContext): Promise<ResolvedRate | null> {
  const currency = await getSecondaryCurrency(prismaExecutor(), ctx.personId);
  if (!currency) return null;
  const rate = await forResidence(ctx.residenceId).currencyRate.findFirst({
    where: { currency },
    select: { currency: true, madPerUnitMinor: true, asOfDate: true },
  });
  if (!rate) return null;
  return {
    currency: rate.currency,
    madPerUnitMinor: rate.madPerUnitMinor,
    asOfDate: rate.asOfDate.toISOString(),
  };
}
