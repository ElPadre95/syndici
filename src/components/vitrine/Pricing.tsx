import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { PricingReadout } from './PricingReadout';

/**
 * Section 6 — Le tarif (J, direction manuscrite). Une règle, pas une grille : 10 MAD/lot/mois,
 * plancher 200 MAD, sans palier. Le CONTENU du prix vient de `pricing.ts`. À droite, le report
 * POUR le visiteur, relié au calculateur d'ouverture. Aéré, sans filet. Fond panneau léger.
 */
export async function Pricing() {
  const t = await getTranslations('vitrine.pricing');

  return (
    <section style={{ background: 'var(--panel)' }}>
      <div className="mx-auto max-w-[1200px] px-6 py-20 lg:py-28">
        <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
          {t('kicker')}
        </p>
        <h2 className="v-hand mt-3 max-w-3xl text-[clamp(2rem,4vw,3.1rem)]" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          <span className="v-leadin">{t('lead')}</span>
        </p>

        <div className="mt-14 grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          {/* La règle, en clair — deux affirmations, pas un tableau */}
          <div>
            <div className="flex flex-col gap-4">
              <p className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--ink)' }}>
                {t('perLot')}
              </p>
              <p className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--ink)' }}>
                {t('min')}
              </p>
            </div>
            <p className="mt-6 max-w-md text-base leading-relaxed" style={{ color: 'var(--ink-3)' }}>
              {t('note')}
            </p>
            <a href="#contact" className="v-btn mt-8 text-base">
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
