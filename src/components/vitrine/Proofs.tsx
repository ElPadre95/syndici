import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

/**
 * Section 5 — Les preuves de sérieux (J1). Des FAITS vérifiables, dans la logique des filets :
 * aucune carte à icône, aucune statistique inventée. Cinq preuves listées, séparées par des
 * filets, appuyées par deux captures réelles (un reçu numéroté, le journal d'audit). Fond blanc.
 */
export async function Proofs({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.proofs');
  const loc = locale === 'ar' ? 'ar' : 'fr';
  const proofs = [
    { n: '01', head: t('r1t'), body: t('r1x') },
    { n: '02', head: t('r2t'), body: t('r2x') },
    { n: '03', head: t('r3t'), body: t('r3x') },
    { n: '04', head: t('r4t'), body: t('r4x') },
    { n: '05', head: t('r5t'), body: t('r5x') },
  ];

  const frame = (img: string, label: string) => (
    <figure>
      <figcaption
        className="v-mono px-4 py-2.5 text-[0.66rem] uppercase tracking-wider"
        style={{ color: 'var(--ink)', border: '1px solid var(--line)', borderBottom: 0, background: 'var(--white)', borderRadius: '4px 4px 0 0' }}
      >
        {label}
      </figcaption>
      <div
        className="relative aspect-[4/3] w-full overflow-hidden"
        style={{ border: '1px solid var(--line)', borderRadius: '0 0 4px 4px' }}
      >
        <Image
          src={img}
          alt={label}
          fill
          sizes="(min-width: 1024px) 40vw, 100vw"
          className="object-cover object-left-top rtl:object-right-top"
        />
      </div>
    </figure>
  );

  return (
    <section style={{ background: 'var(--white)' }}>
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
        <p className="v-kicker">{t('kicker')}</p>
        <h2 className="v-title mt-4 max-w-3xl text-[clamp(1.9rem,3.6vw,2.9rem)]" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: 'var(--ink-2)' }}>
          {t('lead')}
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Les preuves, listées et séparées par des filets */}
          <div className="lg:col-span-7">
            {proofs.map((p, i) => (
              <div
                key={p.n}
                className="grid grid-cols-[auto_1fr] gap-x-5 py-5"
                style={i > 0 ? { borderTop: '1px solid var(--line)' } : undefined}
              >
                <span className="v-mono text-sm" style={{ color: 'var(--accent)' }}>
                  {p.n}
                </span>
                <div>
                  <h3 className="v-title text-lg sm:text-xl" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                    {p.head}
                  </h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    {p.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Deux captures réelles : le reçu numéroté, puis le journal d'audit */}
          <div className="flex flex-col gap-8 lg:col-span-5">
            {frame(`/marketing/recu-${loc}.png`, t('capR'))}
            {frame(`/marketing/journal-${loc}.png`, t('capJ'))}
          </div>
        </div>
      </div>
    </section>
  );
}
