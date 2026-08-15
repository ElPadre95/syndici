'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, CalendarClock, AlertTriangle, Home } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import { Alert } from '@/components/ui/Alert';

export interface OwnerLotView {
  lotId: string;
  reference: string;
  isChargePayer: boolean;
  totalRemainingMinor: number;
  nextDueDate: string | null;
  maxDaysLate: number;
  overdue: boolean;
  settledAll: boolean;
}

/**
 * Situation de paiement du propriétaire (G1) — le cœur de l'accueil (« où j'en suis »).
 * Un sélecteur de lot (le cas MRE multi-lots) et, pour le lot choisi : à jour, ou montant
 * dû + échéance, avec un bandeau rouge s'il est en retard. Si les charges sont déléguées au
 * locataire, c'est dit clairement — le propriétaire reste concerné même s'il ne paie pas.
 */
export function OwnerLotPanel({
  lots,
  rate = null,
}: {
  lots: OwnerLotView[];
  rate?: { currency: string; madPerUnitMinor: number } | null;
}) {
  const t = useTranslations('owner');
  const tCur = useTranslations('currency');
  const locale = useLocale();
  const [sel, setSel] = useState(0);
  const lot = lots[sel];
  if (!lot) return null;

  const fmt = (m: number) => formatMoney(m, locale);
  // Conversion INDICATIVE (H5) — à côté du dirham, jamais à la place. `madPerUnitMinor` =
  // centimes MAD pour 1 unité de la devise. Le montant réel reste en MAD.
  const secondary = (minor: number): string | null =>
    rate && rate.madPerUnitMinor > 0
      ? new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: rate.currency,
          maximumFractionDigits: 0,
        }).format(minor / rate.madPerUnitMinor)
      : null;
  const dueDate = lot.nextDueDate
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
        new Date(lot.nextDueDate),
      )
    : null;

  return (
    <div className="flex flex-col gap-3">
      {lots.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('lots')}>
          {lots.map((l, i) => (
            <button
              key={l.lotId}
              type="button"
              role="tab"
              aria-selected={i === sel}
              onClick={() => setSel(i)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-note font-bold transition-colors',
                i === sel
                  ? 'bg-indigo text-white'
                  : 'border border-sep bg-card text-label-2 hover:bg-bg',
              )}
            >
              <Home className="size-3.5" aria-hidden />
              {t('lot', { ref: l.reference })}
            </button>
          ))}
        </div>
      )}

      <section
        className={cn(
          'rounded-lg border p-5 shadow-sm',
          lot.settledAll
            ? 'border-green/20 bg-green-soft'
            : lot.overdue
              ? 'border-red/20 bg-red-soft'
              : 'border-sep bg-card',
        )}
      >
        <p className="text-eyebrow font-bold uppercase text-label-4">
          {t('situationTitle')}
          {lots.length === 1 && (
            <span className="ms-1 text-label-3">· {t('lot', { ref: lot.reference })}</span>
          )}
        </p>

        {lot.settledAll ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-green text-white">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-section font-bold text-green">{t('upToDate')}</p>
              <p className="text-note text-label-3">{t('upToDateSub')}</p>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-eyebrow font-semibold uppercase text-label-4">
                  {t('amountDue')}
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-display font-extrabold tabular-nums',
                    lot.overdue ? 'text-red' : 'text-label',
                  )}
                >
                  {fmt(lot.totalRemainingMinor)}
                </p>
                {secondary(lot.totalRemainingMinor) && (
                  <p className="text-note text-label-4">
                    ≈ {secondary(lot.totalRemainingMinor)} · {tCur('indicative')}
                  </p>
                )}
              </div>
              {dueDate && (
                <div className="flex items-center gap-2 text-body text-label-3">
                  <CalendarClock className="size-4 text-label-4" aria-hidden />
                  <span>
                    {t('nextDue')} · <span className="font-semibold text-label-2">{dueDate}</span>
                  </span>
                </div>
              )}
            </div>
            {lot.overdue && (
              <Alert tone="danger">{t('lateBanner', { days: lot.maxDaysLate })}</Alert>
            )}
          </div>
        )}

        {!lot.isChargePayer && (
          <p className="mt-4 flex items-center gap-2 rounded-md bg-bg px-3 py-2 text-note text-label-3">
            <AlertTriangle className="size-4 shrink-0 text-label-4" aria-hidden />
            {t('delegated')}
          </p>
        )}
      </section>
    </div>
  );
}
