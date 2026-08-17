import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { PricingReadout } from './PricingReadout';

/**
 * Section 6 — Le tarif (J1). Une règle, pas une grille : 10 MAD/lot/mois, plancher 200 MAD,
 * sans palier. Le CONTENU du prix vient de `pricing.ts` (source unique modifiable). À droite,
 * le report POUR le visiteur, relié au calculateur d'ouverture. Fond #F6F8FA.
 */
export async function Pricing() {
  const t = await getTranslations('vitrine.pricing');

  return (
    <section style={{ background: 'var(--panel)', borderBlock: '1px solid var(--line)' }}>
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
        <p className="v-kicker">{t('kicker')}</p>
        <h2 className="v-title mt-4 max-w-3xl text-[clamp(1.9rem,3.6vw,2.9rem)]" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: 'var(--ink-2)' }}>
          {t('lead')}
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-14">
          {/* La règle, en clair */}
          <div style={{ borderTop: '1px solid var(--line)' }}>
            <div className="flex items-baseline justify-between gap-4 py-5" style={{ borderBottom: '1px solid var(--line)' }}>
              <span className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
                {t('perLot')}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-5" style={{ borderBottom: '1px solid var(--line)' }}>
              <span className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
                {t('min')}
              </span>
            </div>
            <p className="mt-5 max-w-md text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>
              {t('note')}
            </p>
            <a href="#contact" className="v-btn mt-7">
              {t('cta')}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </a>
          </div>

          {/* Le report pour le visiteur — relié au calculateur */}
          <PricingReadout />
        </div>
      </div>
    </section>
  );
}
