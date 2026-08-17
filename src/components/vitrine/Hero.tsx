import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { Calculator } from './Calculator';
import { Loop, Underline, Arrow } from './Scribbles';

/**
 * Section d'ouverture (J), direction « MANUSCRIT » (référence : page produit Odoo). Généreux,
 * aéré, humain : titre à la main TRÈS grand (Caveat en fr, Aref Ruqaa en ar), amorce en gras
 * façon Odoo, et une capture GRANDE et LISIBLE — un cadre serré sur le bloc trésorerie (pas
 * l'écran entier rétréci), flottante, ombre douce, sans chrome, qui déborde du bord.
 * TROIS annotations dessinées seulement : une boucle sur le mot clé, une flèche vers la
 * capture, un souligné sous la mention légale. Le cobalt reste réservé à l'action.
 */
export async function Hero({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.hero');
  const isAr = locale === 'ar';
  const shot = `/marketing/hero-treasury-${isAr ? 'ar' : 'fr'}.png`;
  // La boucle est calée PAR LANGUE : la ruq'ah (ar) est plus haute et ses lignes sont
  // resserrées → boucle plus basse et plus serrée pour ne croiser ni lettre ni diacritique.
  const loopClass = isAr
    ? // « يرى » est le mot final (espace vide à sa gauche/fin) → peu d'air côté début (vers
      // « والمالك »), généreux côté fin, pour n'effleurer aucune lettre.
      'pointer-events-none absolute start-[-0.28em] end-[-0.72em] top-[0.06em] h-[1.34em] w-[calc(100%+1em)]'
    : 'pointer-events-none absolute start-[-0.5em] end-[-0.5em] top-[-0.28em] h-[1.68em] w-[calc(100%+1em)]';

  return (
    <section className="relative overflow-hidden" style={{ background: 'var(--white)' }}>
      <div className="mx-auto grid max-w-[1240px] items-center gap-y-16 px-6 pb-4 pt-20 lg:grid-cols-12 lg:gap-x-8 lg:pt-28">
        {/* Colonne discours */}
        <div className="lg:col-span-6">
          {/* Titre manuscrit, très grand. Une boucle au feutre entoure LE MOT CLÉ, avec de l'air. */}
          <h1 className="v-hand text-[clamp(3rem,7vw,5.4rem)]" style={{ color: 'var(--ink)' }}>
            <span className="block">{t('title1')}</span>
            <span className="block">
              {t('title2lead')}{' '}
              <span className="relative inline-block">
                {t('title2mark')}
                <Loop className={loopClass} color="var(--ann-blue)" />
              </span>
            </span>
          </h1>

          {/* Amorce en gras (façon Odoo) + paragraphe. */}
          <p className="mt-10 max-w-xl text-lg leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            <span className="v-leadin">{t('leadIn')} </span>
            {t('lead')}
          </p>

          {/* Action (cobalt) + mention « conforme à la loi », soulignée au feutre. */}
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href="#contact" className="v-btn text-base">
              {t('cta')}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </a>
            <span className="relative inline-block">
              <span
                className="v-annote text-xl"
                style={{ ['--ann-color' as string]: 'var(--ann-amber)' }}
              >
                {t('annLaw')}
              </span>
              <Underline
                className="absolute inset-x-0 top-full h-3 w-full"
                color="var(--ann-amber)"
              />
            </span>
          </div>
        </div>

        {/* Capture — GRANDE, lisible (cadre serré trésorerie), flottante, débordant du bord. */}
        <div className="lg:col-span-6">
          <figure className="relative lg:mx-0">
            {/* Flèche + mention « en arabe aussi » qui pointe la capture (ancrée à la capture). */}
            <div
              className="absolute -top-9 start-6 z-10 hidden w-44 sm:block"
              style={{ ['--ann-color' as string]: 'var(--ann-green)' }}
            >
              <span className="v-annote block text-2xl" style={{ transform: 'rotate(-3deg)' }}>
                {t('annBilingual')}
              </span>
              <Arrow className="mt-1 h-12 w-20 rtl:-scale-x-100" color="var(--ann-green)" strokeWidth={2.8} />
            </div>

            <div
              className="v-float overflow-hidden ltr:lg:ms-8 ltr:lg:me-[-9vw] rtl:lg:me-8 rtl:lg:ms-[-9vw]"
              style={{ transform: 'rotate(-1.2deg)' }}
            >
              <Image
                src={shot}
                alt={t('shotAlt')}
                width={1180}
                height={560}
                priority
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="h-auto w-full"
              />
            </div>
          </figure>
        </div>
      </div>

      {/* Le calculateur — bande à part, centrée, très aérée (l'enjeu chiffré du visiteur). */}
      <div className="mx-auto max-w-[1240px] px-6 pb-24 pt-6 lg:pb-28">
        <div className="mx-auto max-w-md">
          <Calculator />
        </div>
      </div>

      {/* Séparateur SOUPLE — bande de fond légère en courbe, plutôt qu'un trait. */}
      <div aria-hidden className="relative h-16 lg:h-24">
        <svg
          className="absolute inset-x-0 bottom-0 h-full w-full"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
        >
          <path d="M0 120 L0 64 C 360 12 720 12 1080 46 C 1260 62 1360 66 1440 52 L1440 120 Z" fill="var(--panel)" />
        </svg>
      </div>
    </section>
  );
}
