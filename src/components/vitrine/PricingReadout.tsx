'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCalc } from './calc-store';
import { monthlySubscription } from '@/server/contact/pricing';
import { formatMoney, toCentimes } from '@/lib/money';

/**
 * Report du tarif POUR le visiteur (J, section 6). Relie le calculateur d'ouverture au prix :
 * s'il a saisi 25 lots, il lit ici « 25 lots → 250 MAD / mois », mis en regard des impayés
 * qu'il ne collecte pas. Carte flottante à l'ombre douce (direction manuscrite). Le calcul du
 * prix vient de la source unique `monthlySubscription` (pricing.ts).
 */
export function PricingReadout() {
  const t = useTranslations('vitrine.pricing');
  const locale = useLocale();
  const { lots, charge } = useCalc();

  const price = formatMoney(monthlySubscription(lots), locale);
  const gap = formatMoney(toCentimes(Math.round(lots * charge * 0.2)), locale);

  return (
    <div className="v-float p-7 lg:p-9" style={{ background: 'var(--white)' }}>
      <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        {t('calcTitle')}
      </p>
      <p
        className="mt-4 font-extrabold tabular-nums leading-none"
        style={{ color: 'var(--accent)', fontSize: 'clamp(2.4rem,6vw,3.4rem)' }}
      >
        {price}
      </p>
      <p className="mt-3 text-sm" style={{ color: 'var(--ink-3)' }}>
        {t('calcLine', { lots, price })}
      </p>
      <p className="mt-4 max-w-sm text-base leading-relaxed" style={{ color: 'var(--ink-2)' }}>
        {t('calcVs', { gap })}
      </p>
    </div>
  );
}
