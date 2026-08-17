'use client';

import { useTranslations } from 'next-intl';
import { useCalc, setCalc } from './calc-store';

/**
 * Calculateur d'impayés (J1) — habillé comme un INSTRUMENT DE MESURE : champs à filets,
 * chiffres tabulaires en monospace, et le résultat qui compte en TRÈS GRAND cobalt. Les
 * chiffres sont ceux DU visiteur ; aucune promesse de résultat, la formule est affichée.
 */
const GROUP = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function Calculator() {
  const t = useTranslations('vitrine.calc');
  // État PARTAGÉ : la section Tarifs et le formulaire de contact réutilisent ces chiffres.
  const { lots, charge } = useCalc();
  const setLots = (n: number) => setCalc({ lots: n });
  const setCharge = (n: number) => setCalc({ charge: n });

  const called = Math.max(0, Math.round(lots * charge));
  const gap = Math.round(called * 0.2);
  const cur = t('currency');
  const fmt = (n: number) => GROUP.format(n);

  const field = (label: string, value: number, setter: (n: number) => void, max: number, suffix?: string) => (
    <label className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          onChange={(e) => setter(Math.min(max, Math.max(0, Math.round(Number(e.target.value) || 0))))}
          className="v-mono w-24 border-b bg-transparent pb-0.5 text-end text-lg font-semibold outline-none focus:border-b-2"
          style={{ color: 'var(--ink)', borderColor: 'var(--accent)' }}
        />
        {suffix && (
          <span className="v-mono text-xs" style={{ color: 'var(--ink-3)' }}>
            {suffix}
          </span>
        )}
      </span>
    </label>
  );

  return (
    <div
      className="v-float overflow-hidden"
      style={{ background: 'var(--white)', border: '1px solid var(--line)' }}
    >
      <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
        <span className="v-kicker">{t('label')}</span>
      </div>

      {/* Entrées — champs à filets */}
      <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
        {field(t('lots'), lots, setLots, 9999)}
        {field(t('charge'), charge, setCharge, 999999, cur)}
      </div>

      {/* Appelé / mois */}
      <div
        className="flex items-baseline justify-between gap-4 px-5 py-4"
        style={{ borderBlock: '1px solid var(--line)', background: 'var(--panel)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('called')}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="v-mono text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
            {fmt(called)}
          </span>
          <span className="v-mono text-xs" style={{ color: 'var(--ink-3)' }}>
            {cur} {t('perMonth')}
          </span>
        </span>
      </div>

      {/* Le chiffre qui compte — très grand, cobalt */}
      <div className="px-5 pb-5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {t('gap')}
          </span>
          <span className="v-mono text-xs" style={{ color: 'var(--ink-3)' }}>
            20 %
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className="v-mono font-semibold leading-none"
            style={{ color: 'var(--accent)', fontSize: 'clamp(2.6rem,7vw,3.7rem)' }}
          >
            −{fmt(gap)}
          </span>
          <span className="v-mono text-base" style={{ color: 'var(--accent)' }}>
            {cur}
          </span>
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--ink-3)' }}>
          {t('gapSub')}
        </p>

        <p className="v-mono mt-4 text-[0.68rem] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          {t('formula', {
            lots: fmt(lots),
            charge: `${fmt(charge)} ${cur}`,
            called: `${fmt(called)} ${cur}`,
            gap: `${fmt(gap)} ${cur}`,
          })}
        </p>
        <p className="mt-2 text-xs" style={{ color: 'var(--ink-3)' }}>
          {t('note')}
        </p>
      </div>
    </div>
  );
}
