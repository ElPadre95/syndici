import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

/**
 * Section 4 — La transparence, côté propriétaire (J1). LE différenciant : il ne doit pas être
 * noyé. Deux captures réelles (écran de transparence + devis comparés / photos avant-après),
 * angles droits, calées contre les filets ; deux points de preuve. Fond #F6F8FA.
 */
export async function OwnerTransparency({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.ownerT');
  const loc = locale === 'ar' ? 'ar' : 'fr';
  const points = [
    { n: '01', head: t('p1t'), body: t('p1x') },
    { n: '02', head: t('p2t'), body: t('p2x') },
  ];

  const frame = (img: string, label: string, alt: string) => (
    <figure>
      <div
        className="flex items-center px-4 py-2.5"
        style={{ border: '1px solid var(--line)', borderBottom: 0, background: 'var(--white)', borderRadius: '4px 4px 0 0' }}
      >
        <figcaption className="v-mono text-[0.66rem] uppercase tracking-wider" style={{ color: 'var(--ink)' }}>
          {label}
        </figcaption>
      </div>
      <div
        className="relative aspect-[16/11] w-full overflow-hidden"
        style={{ border: '1px solid var(--line)', borderRadius: '0 0 4px 4px' }}
      >
        <Image
          src={img}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover object-left-top rtl:object-right-top"
        />
      </div>
    </figure>
  );

  return (
    <section style={{ background: 'var(--panel)', borderBlock: '1px solid var(--line)' }}>
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
        <p className="v-kicker">{t('kicker')}</p>
        <h2 className="v-title mt-4 max-w-3xl text-[clamp(2rem,4vw,3.2rem)]" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: 'var(--ink-2)' }}>
          {t('lead')}
        </p>

        {/* Capture-phare : l'écran de transparence */}
        <div className="mt-12">{frame(`/marketing/transparence-${loc}.png`, t('capT'), t('capT'))}</div>

        {/* Preuve : devis comparés + photos avant/après */}
        <div className="mt-12 grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="lg:pt-4">
            {points.map((p, i) => (
              <div
                key={p.n}
                className="py-5"
                style={i > 0 ? { borderTop: '1px solid var(--line)' } : undefined}
              >
                <span className="v-mono text-sm" style={{ color: 'var(--accent)' }}>
                  {p.n}
                </span>
                <h3 className="v-title mt-2 text-xl" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                  {p.head}
                </h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                  {p.body}
                </p>
              </div>
            ))}
          </div>
          {frame(`/marketing/travaux-${loc}.png`, t('capW'), t('capW'))}
        </div>
      </div>
    </section>
  );
}
