import { getTranslations } from 'next-intl/server';
import { Shot } from './Shot';

/**
 * Section 3 — Ce que fait le produit (J, direction manuscrite). Quatre capacités en lignes
 * ALTERNÉES (gauche/droite), façon Odoo : une amorce en gras, un texte, et une capture
 * flottante RECADRÉE sur une zone lisible (pas d'écran entier). Aéré, sans filet ni carte à
 * icône. Fond blanc. (Aucune annotation ici : le quota de la page est déjà tenu ailleurs.)
 */
export async function Product({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.product');
  const loc = locale === 'ar' ? 'ar' : 'fr';
  const blocks = [
    { head: t('b1t'), body: t('b1x'), img: `/marketing/crop-paiements-${loc}.png`, rotate: -1.2 },
    { head: t('b2t'), body: t('b2x'), img: `/marketing/crop-relances-${loc}.png`, rotate: 1.1 },
    { head: t('b3t'), body: t('b3x'), img: `/marketing/crop-depenses-${loc}.png`, rotate: -1 },
    { head: t('b4t'), body: t('b4x'), img: `/marketing/crop-compte-${loc}.png`, rotate: 1.2 },
  ];

  return (
    <section style={{ background: 'var(--white)' }}>
      <div className="mx-auto max-w-[1200px] px-6 py-20 lg:py-28">
        <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
          {t('kicker')}
        </p>
        <h2 className="v-hand mt-3 max-w-3xl text-[clamp(2rem,4vw,3.1rem)]" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h2>

        <div className="mt-16 flex flex-col gap-20 lg:gap-28">
          {blocks.map((b, i) => {
            const reverse = i % 2 === 1;
            return (
              <div key={b.head} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={reverse ? 'lg:order-2' : ''}>
                  <h3 className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--ink)' }}>
                    {b.head}
                  </h3>
                  <p className="mt-4 max-w-md text-lg leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    {b.body}
                  </p>
                </div>
                <Shot
                  src={b.img}
                  alt={b.head}
                  rotate={b.rotate}
                  className={reverse ? 'lg:order-1' : ''}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
