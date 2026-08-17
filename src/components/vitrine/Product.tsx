import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

/**
 * Section 3 — Ce que fait le produit (J1). Quatre blocs, chacun une VRAIE capture (grande,
 * angles droits, sans cadre ni ombre) et un texte, alternés et séparés par des filets. Pas de
 * carte à icône : la capture EST l'argument.
 */
export async function Product({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.product');
  const loc = locale === 'ar' ? 'ar' : 'fr';
  const blocks = [
    { n: '01', head: t('b1t'), body: t('b1x'), img: `/marketing/paiements-${loc}.png` },
    { n: '02', head: t('b2t'), body: t('b2x'), img: `/marketing/relances-${loc}.png` },
    { n: '03', head: t('b3t'), body: t('b3x'), img: `/marketing/depenses-${loc}.png` },
    { n: '04', head: t('b4t'), body: t('b4x'), img: `/marketing/compte-${loc}.png` },
  ];

  return (
    <section style={{ background: 'var(--white)' }}>
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
        <p className="v-kicker">{t('kicker')}</p>
        <h2 className="v-title mt-4 max-w-3xl text-[clamp(1.9rem,3.6vw,2.9rem)]" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h2>

        <div className="mt-6">
          {blocks.map((b, i) => {
            const reverse = i % 2 === 1;
            return (
              <div
                key={b.n}
                className="grid items-center gap-8 py-12 lg:grid-cols-2 lg:gap-12"
                style={{ borderTop: '1px solid var(--line)' }}
              >
                <div className={reverse ? 'lg:order-2' : ''}>
                  <span className="v-mono text-sm" style={{ color: 'var(--accent)' }}>
                    {b.n} — 04
                  </span>
                  <h3
                    className="v-title mt-3 text-2xl sm:text-3xl"
                    style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
                  >
                    {b.head}
                  </h3>
                  <p className="mt-4 max-w-md text-base leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    {b.body}
                  </p>
                </div>
                <div className={reverse ? 'lg:order-1' : ''}>
                  <div
                    className="relative aspect-[16/10] w-full overflow-hidden"
                    style={{ border: '1px solid var(--line)', borderRadius: '4px' }}
                  >
                    <Image
                      src={b.img}
                      alt={b.head}
                      fill
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover object-left-top rtl:object-right-top"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
