'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Calculateur d'impayés (J1) — les CHIFFRES DU VISITEUR, aucune promesse de résultat. Il saisit
 * le nombre de lots et la charge mensuelle ; la page affiche le montant appelé chaque mois et ce
 * que représentent 20 points de collecte manquants. Présenté comme un bordereau de calcul.
 */
const GROUP = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function Calculator() {
  const t = useTranslations('vitrine.calc');
  const [lots, setLots] = useState(25);
  const [charge, setCharge] = useState(650);

  const called = Math.max(0, Math.round(lots * charge));
  const gap = Math.round(called * 0.2);
  const cur = t('currency');
  const fmt = (n: number) => GROUP.format(n);

  const field = (
    label: string,
    value: number,
    setter: (n: number) => void,
    max: number,
    suffix?: string,
  ) => (
    <label className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
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
          className="v-mono w-24 border-b-2 bg-transparent pb-1 text-end text-xl font-semibold outline-none"
          style={{ color: 'var(--ink)', borderColor: 'var(--line-strong)' }}
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
    <div className="v-panel p-6 sm:p-7">
      <div className="flex items-center justify-between">
        <span className="v-kicker">{t('label')}</span>
        <span className="v-mono text-xs" style={{ color: 'var(--ink-3)' }}>
          × 12
        </span>
      </div>

      <div className="mt-2 divide-y" style={{ borderColor: 'var(--line)' }}>
        {field(t('lots'), lots, setLots, 9999)}
        {field(t('charge'), charge, setCharge, 999999, cur)}
      </div>

      <hr className="v-rule my-4" />

      {/* Appelé chaque mois */}
      <div className="flex items-end justify-between gap-4">
        <span className="max-w-[9rem] text-sm font-semibold leading-tight" style={{ color: 'var(--ink-2)' }}>
          {t('called')}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="v-mono text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--ink)' }}>
            {fmt(called)}
          </span>
          <span className="v-mono text-sm" style={{ color: 'var(--ink-3)' }}>
            {cur} {t('perMonth')}
          </span>
        </span>
      </div>

      {/* 20 points manquants — le seul chiffre en accent : l'enjeu. */}
      <div
        className="mt-4 flex items-end justify-between gap-4 border-s-2 ps-4"
        style={{ borderColor: 'var(--accent)' }}
      >
        <span className="max-w-[10rem] text-sm font-bold leading-tight" style={{ color: 'var(--ink)' }}>
          {t('gap')}
          <span className="block text-xs font-normal" style={{ color: 'var(--ink-3)' }}>
            {t('gapSub')}
          </span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="v-mono text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--accent)' }}>
            −{fmt(gap)}
          </span>
          <span className="v-mono text-sm" style={{ color: 'var(--accent)' }}>
            {cur}
          </span>
        </span>
      </div>

      <p className="v-mono mt-5 text-[0.68rem] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
        {t('formula', {
          lots: fmt(lots),
          charge: `${fmt(charge)} ${cur}`,
          called: `${fmt(called)} ${cur}`,
          gap: `${fmt(gap)} ${cur}`,
        })}
      </p>
      <p className="mt-2 text-xs italic" style={{ color: 'var(--ink-3)' }}>
        {t('note')}
      </p>
    </div>
  );
}
