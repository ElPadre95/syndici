import { getTranslations } from 'next-intl/server';

/**
 * Section 2 — Le problème (J1). Trois constats, structurés par des filets verticaux (une
 * grille visible), index en monospace. Fond #F6F8FA (section alternée). Aucune icône, aucun
 * héros : de la densité aérée par les filets.
 */
export async function Problem() {
  const t = await getTranslations('vitrine.problem');
  const items = [
    { n: '01', head: t('n1'), body: t('t1') },
    { n: '02', head: t('n2'), body: t('t2') },
    { n: '03', head: t('n3'), body: t('t3') },
  ];

  return (
    <section style={{ background: 'var(--panel)', borderBlock: '1px solid var(--line)' }}>
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
        <p className="v-kicker">{t('kicker')}</p>
        <h2 className="v-title mt-4 max-w-3xl text-[clamp(1.9rem,3.6vw,2.9rem)]" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h2>

        <div className="mt-12 grid gap-x-0 gap-y-10 md:grid-cols-3">
          {items.map((it, i) => (
            <div
              key={it.n}
              className={`md:pe-8 ${i > 0 ? 'md:ps-8' : ''}`}
              style={i > 0 ? { borderInlineStart: '1px solid var(--line)' } : undefined}
            >
              <span className="v-mono text-sm" style={{ color: 'var(--accent)' }}>
                {it.n}
              </span>
              <h3 className="v-title mt-3 text-xl" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                {it.head}
              </h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {it.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
