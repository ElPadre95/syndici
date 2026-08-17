import { getTranslations } from 'next-intl/server';
import { Plus } from 'lucide-react';

/**
 * Section 7 — Les questions fréquentes (J, direction manuscrite). Réponses honnêtes (le paiement
 * en ligne n'est PAS encore connecté, on le dit). Accordéon natif `<details>` (fonctionne sans
 * JS), aéré, cartes souples plutôt que filets. Fond blanc.
 */
export async function Faq() {
  const t = await getTranslations('vitrine.faq');
  const items = [
    { q: t('q1'), a: t('a1') },
    { q: t('q2'), a: t('a2') },
    { q: t('q3'), a: t('a3') },
    { q: t('q4'), a: t('a4') },
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

        <div className="mt-12 flex max-w-3xl flex-col gap-4">
          {items.map((it) => (
            <details
              key={it.q}
              className="group px-6 py-5"
              style={{ background: 'var(--panel)', borderRadius: '14px' }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-lg font-bold sm:text-xl" style={{ color: 'var(--ink)' }}>
                  {it.q}
                </span>
                <Plus
                  className="size-5 shrink-0 transition-transform group-open:rotate-45"
                  style={{ color: 'var(--accent)' }}
                  aria-hidden
                />
              </summary>
              <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
