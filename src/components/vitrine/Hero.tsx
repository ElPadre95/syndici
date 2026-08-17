import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { Calculator } from './Calculator';

/**
 * Section d'ouverture (J1), direction « L'INSTRUMENT ». Blanc, aligné à gauche, structuré par
 * des FILETS (kicker souligné, filet vertical entre les colonnes) plutôt que par du vide. La
 * capture réelle de l'écran de transparence déborde du bord (fin), calée contre les filets,
 * sans cadre ni ombre. Le calculateur est un instrument de mesure.
 */
export async function Hero({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.hero');
  // Le tableau de bord parle plus qu'un écran de transparence en capture. La transparence est
  // réservée à sa propre section (4). Jeu de données marketing (aucun nominatif).
  const shot = `/marketing/dashboard-${locale === 'ar' ? 'ar' : 'fr'}.png`;

  return (
    <section className="relative overflow-hidden" style={{ background: 'var(--white)' }}>
      <div className="mx-auto max-w-[1280px] px-6">
        {/* Kicker souligné d'un filet, pleine largeur */}
        <div className="py-4" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="v-kicker">{t('kicker')}</span>
        </div>

        <div className="grid lg:grid-cols-12">
          {/* Colonne discours + instrument */}
          <div
            className="lg:col-span-7 lg:pe-12"
            style={{ borderInlineEnd: '1px solid var(--line)' }}
          >
            <h1 className="v-title mt-9 text-[clamp(2.5rem,5.6vw,4.2rem)]" style={{ color: 'var(--ink)' }}>
              <span className="block">{t('title1')}</span>
              <span className="block">{t('title2')}</span>
            </h1>
            <p
              className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
              style={{ color: 'var(--ink-2)' }}
            >
              {t('lead')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#contact" className="v-btn">
                {t('cta')}
                <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </a>
            </div>

            <hr className="my-9" style={{ border: 0, borderTop: '1px solid var(--line)' }} />

            <div className="max-w-xl pb-12">
              <Calculator />
            </div>
          </div>

          {/* Capture-phare — déborde du bord (fin), calée contre les filets, sans cadre */}
          <figure className="lg:relative lg:col-span-5" style={{ borderInlineStart: '1px solid var(--line)' }}>
            <div
              className="flex flex-col lg:absolute lg:inset-y-9 lg:end-[-14vw] lg:start-12"
              style={{ borderTop: '1px solid var(--line)' }}
            >
              {/* Bandeau d'étiquette — libellé produit, sans recouvrir la capture */}
              <figcaption
                className="v-mono flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2.5 text-[0.66rem]"
                style={{ borderBottom: '1px solid var(--line)', background: 'var(--white)' }}
              >
                <span className="uppercase tracking-wider" style={{ color: 'var(--ink)' }}>
                  {t('shotTag')}
                </span>
                <span style={{ color: 'var(--ink-3)' }}>· {t('shotCaption')}</span>
              </figcaption>
              <div className="relative min-h-[440px] flex-1">
                <Image
                  src={shot}
                  alt={t('shotAlt')}
                  fill
                  priority
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  /* Ancré au DÉBUT (barre latérale visible) → le débordement se fait d'un seul
                     côté, franchement, à la fin. Miroir en arabe. */
                  className="object-cover object-left-top rtl:object-right-top"
                />
              </div>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
