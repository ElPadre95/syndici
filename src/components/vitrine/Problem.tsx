import { getTranslations } from 'next-intl/server';

/**
 * Section 2 — Le problème (J, direction manuscrite). Titre de section à la main (plus petit
 * que l'ouverture). Trois constats aérés, séparés par de l'AIR, pas par des filets ni des
 * cartes à icône. Fond panneau léger.
 */
export async function Problem() {
  const t = await getTranslations('vitrine.problem');
  const items = [
    { n: '01', head: t('n1'), body: t('t1') },
    { n: '02', head: t('n2'), body: t('t2') },
    { n: '03', head: t('n3'), body: t('t3') },
  ];

  return (
    <section style={{ background: 'var(--panel)' }}>
      <div className="mx-auto max-w-[1200px] px-6 py-20 lg:py-28">
        <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
          {t('kicker')}
        </p>
        <h2 className="v-hand mt-3 max-w-3xl text-[clamp(2rem,4vw,3.1rem)]" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h2>

        <div className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-3">
          {items.map((it) => (
            <div key={it.n}>
              <span
                className="v-hand text-4xl"
                style={{ color: 'var(--accent)' }}
              >
                {it.n}
              </span>
              <h3 className="mt-3 text-xl font-bold" style={{ color: 'var(--ink)' }}>
                {it.head}
              </h3>
              <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {it.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
