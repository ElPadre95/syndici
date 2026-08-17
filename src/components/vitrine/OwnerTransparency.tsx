import { getTranslations } from 'next-intl/server';
import { Shot } from './Shot';

/**
 * Section 4 — La transparence, côté propriétaire (J, direction manuscrite). LE différenciant.
 * Titre à la main, amorce en gras, puis deux lignes alternées : les devis mis en concurrence
 * (crop du tableau comparatif) et les photos avant/après. Captures flottantes RECADRÉES sur la
 * zone parlante. Fond panneau léger.
 */
export async function OwnerTransparency({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.ownerT');
  const loc = locale === 'ar' ? 'ar' : 'fr';

  return (
    <section id="transparence" style={{ background: 'var(--panel)', scrollMarginBlockStart: '4rem' }}>
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

        <div className="mt-16 flex flex-col gap-20 lg:gap-28">
          {/* Devis mis en concurrence — le tableau comparatif */}
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h3 className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--ink)' }}>
                {t('p1t')}
              </h3>
              <p className="mt-4 max-w-md text-lg leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {t('p1x')}
              </p>
            </div>
            <Shot src={`/marketing/crop-devis-${loc}.png`} alt={t('capT')} rotate={-1.1} />
          </div>

          {/* Photos avant / après */}
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Shot src={`/marketing/crop-travaux-${loc}.png`} alt={t('capW')} rotate={1.1} className="lg:order-1" />
            <div className="lg:order-2">
              <h3 className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--ink)' }}>
                {t('p2t')}
              </h3>
              <p className="mt-4 max-w-md text-lg leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {t('p2x')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
