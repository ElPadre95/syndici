import { getLocale, getTranslations } from 'next-intl/server';
import { convertMinor, type ResolvedRate } from '@/server/finance/currency';

/**
 * Conversion INDICATIVE d'un montant MAD vers la devise secondaire du propriétaire (H5).
 * Affiché à côté du dirham, jamais à la place : le montant réel reste en MAD. Rendu
 * seulement si un taux est résolu (sinon `null`).
 */
export async function SecondaryAmount({
  minor,
  rate,
  className,
}: {
  minor: number;
  rate: ResolvedRate | null;
  className?: string;
}) {
  if (!rate) return null;
  const t = await getTranslations('currency');
  const locale = await getLocale();
  const value = convertMinor(minor, rate.madPerUnitMinor);
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: rate.currency,
    maximumFractionDigits: 0,
  }).format(value);
  return (
    <span className={className ?? 'text-note text-label-4'}>
      ≈ {formatted} · {t('indicative')}
    </span>
  );
}
