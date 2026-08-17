'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCalc } from './calc-store';
import { monthlySubscription } from '@/server/contact/pricing';
import { formatMoney, toCentimes } from '@/lib/money';

/**
 * Report du tarif POUR le visiteur (J1, section 6). Relie le calculateur d'ouverture au prix :
 * s'il a saisi 25 lots, il lit ici « 25 lots → 250 MAD / mois », mis en regard des impayés
 * qu'il ne collecte pas. Tant qu'il n'a pas touché au calculateur, on invite sans inventer de
 * chiffre. Le calcul du prix vient de la source unique `monthlySubscription` (pricing.ts).
 */
export function PricingReadout() {
  const t = useTranslations('vitrine.pricing');
  const locale = useLocale();
  // On affiche TOUJOURS le calcul, à partir des valeurs courantes du calculateur (par défaut
  // 25 lots) : un ancrage concret pour chaque visiteur, mis à jour dès qu'il change ses chiffres.
  const { lots, charge } = useCalc();

  const price = formatMoney(monthlySubscription(lots), locale);
  const gap = formatMoney(toCentimes(Math.round(lots * charge * 0.2)), locale);

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: '4px', background: 'var(--white)' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
        <span className="v-kicker">{t('calcTitle')}</span>
      </div>
      <div className="px-5 py-6">
        <div className="flex items-baseline gap-2">
          <span className="v-mono leading-none" style={{ color: 'var(--accent)', fontSize: 'clamp(2.2rem,5.5vw,3rem)' }}>
            {price}
          </span>
        </div>
        <p className="v-mono mt-3 text-[0.72rem]" style={{ color: 'var(--ink-3)' }}>
          {t('calcLine', { lots, price })}
        </p>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {t('calcVs', { gap })}
        </p>
      </div>
    </div>
  );
}
