import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { Calculator } from './Calculator';

/**
 * Section d'ouverture de la vitrine (J1) — la promesse, le calculateur d'enjeu, et une VRAIE
 * capture de l'écran de transparence du propriétaire (dans la langue de la page). Composition
 * asymétrique : la colonne de gauche porte le discours et le calcul ; la capture déborde du
 * bord (fin) à droite. Aucun centrage systématique, un seul accent.
 */
export async function Hero({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.hero');
  const shot = `/marketing/transparence-${locale === 'ar' ? 'ar' : 'fr'}.png`;

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-[1240px] px-6 pb-16 pt-12 sm:pt-16 lg:pb-24">
        <div className="grid items-start gap-y-12 lg:grid-cols-[1.06fr_0.94fr] lg:gap-x-10">
          {/* Colonne discours + calcul */}
          <div className="max-w-xl">
            <p className="v-kicker">{t('kicker')}</p>
            <h1 className="v-display mt-5 text-[clamp(2.6rem,6vw,4.4rem)]">
              <span className="block" style={{ color: 'var(--ink)' }}>
                {t('title1')}
              </span>
              <span
                className="mt-1 inline-block pb-1"
                style={{ color: 'var(--ink)', boxShadow: 'inset 0 -0.28em 0 var(--accent-soft)' }}
              >
                {t('title2')}
              </span>
            </h1>
            <p className="mt-6 text-base leading-relaxed sm:text-lg" style={{ color: 'var(--ink-2)' }}>
              {t('lead')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a href="#contact" className="v-btn">
                {t('cta')}
                <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </a>
            </div>

            <div className="mt-10">
              <Calculator />
            </div>
          </div>

          {/* Capture-phare — déborde du bord (fin) sur grand écran */}
          <figure className="relative lg:min-h-[560px]">
            <div className="v-panel overflow-hidden lg:absolute lg:inset-y-0 lg:start-0 lg:end-[-13vw]">
              <div className="relative aspect-[16/11] w-full lg:h-full">
                <Image
                  src={shot}
                  alt={t('shotAlt')}
                  fill
                  priority
                  sizes="(min-width: 1024px) 62vw, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <span
                className="v-mono absolute top-0 px-3 py-1.5 text-[0.68rem] uppercase tracking-wider text-white"
                style={{ background: 'var(--accent)', insetInlineStart: 0 }}
              >
                {t('shotTag')}
              </span>
            </div>
            <figcaption
              className="v-mono mt-4 text-xs lg:absolute lg:bottom-[-2.2rem] lg:start-1"
              style={{ color: 'var(--ink-3)' }}
            >
              {t('shotCaption')}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
