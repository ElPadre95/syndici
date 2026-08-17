import { getTranslations } from 'next-intl/server';
import { Shot } from './Shot';
import { Arrow } from './Scribbles';

/**
 * Section 5 — Les preuves de sérieux (J, direction manuscrite). Des FAITS vérifiables, aérés,
 * sans carte à icône. Deux captures RECADRÉES : un reçu numéroté et le journal d'audit. C'est
 * ici qu'on place la SEULE annotation dessinée du reste de la page (« Sans trou », vers le reçu)
 * — le quota (trois dans l'ouverture) impose au plus une de plus, là où elle compte. Fond blanc.
 */
export async function Proofs({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.proofs');
  const loc = locale === 'ar' ? 'ar' : 'fr';
  const proofs = [
    { head: t('r1t'), body: t('r1x') },
    { head: t('r2t'), body: t('r2x') },
    { head: t('r3t'), body: t('r3x') },
    { head: t('r4t'), body: t('r4x') },
    { head: t('r5t'), body: t('r5x') },
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
        <p className="mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          <span className="v-leadin">{t('lead')}</span>
        </p>

        <div className="mt-14 grid gap-x-16 gap-y-12 lg:grid-cols-2">
          {/* Les cinq preuves, aérées */}
          <ul className="flex flex-col gap-8">
            {proofs.map((p) => (
              <li key={p.head}>
                <h3 className="text-lg font-bold sm:text-xl" style={{ color: 'var(--ink)' }}>
                  {p.head}
                </h3>
                <p className="mt-2 max-w-md text-base leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                  {p.body}
                </p>
              </li>
            ))}
          </ul>

          {/* Les deux captures : reçu numéroté (annoté « Sans trou ») + journal d'audit */}
          <div className="flex flex-col gap-10">
            <div className="relative">
              {/* SEULE annotation du reste de la page */}
              <div
                className="absolute -top-8 end-2 z-10 hidden w-40 text-end sm:block"
                style={{ ['--ann-color' as string]: 'var(--ann-blue)' }}
              >
                <span className="v-annote block text-2xl" style={{ transform: 'rotate(4deg)' }}>
                  {t('annNoGap')}
                </span>
                <Arrow className="ms-auto mt-1 h-12 w-20 -scale-x-100 rtl:scale-x-100" color="var(--ann-blue)" strokeWidth={2.8} />
              </div>
              <Shot src={`/marketing/crop-recu-${loc}.png`} alt={t('capR')} rotate={-1.1} />
            </div>
            <Shot src={`/marketing/crop-journal-${loc}.png`} alt={t('capJ')} rotate={1} />
          </div>
        </div>
      </div>
    </section>
  );
}
