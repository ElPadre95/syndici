import { getTranslations } from 'next-intl/server';
import { Plus } from 'lucide-react';

/**
 * Section 7 — Les questions fréquentes (J1). Réponses honnêtes, sans esquive : le paiement en
 * ligne n'est PAS encore connecté, on le dit. Accordéon natif `<details>` (fonctionne sans JS),
 * séparé par des filets, aucune carte. Fond blanc.
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
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
        <p className="v-kicker">{t('kicker')}</p>
        <h2 className="v-title mt-4 max-w-3xl text-[clamp(1.9rem,3.6vw,2.9rem)]" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h2>

        <div className="mt-10 max-w-3xl" style={{ borderTop: '1px solid var(--line)' }}>
          {items.map((it) => (
            <details key={it.q} className="group" style={{ borderBottom: '1px solid var(--line)' }}>
              <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 marker:content-['']">
                <span className="v-title text-lg sm:text-xl" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                  {it.q}
                </span>
                <Plus
                  className="size-5 shrink-0 transition-transform group-open:rotate-45"
                  style={{ color: 'var(--accent)' }}
                  aria-hidden
                />
              </summary>
              <p className="max-w-2xl pb-6 text-[0.95rem] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
