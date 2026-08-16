'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Printer, RotateCcw, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/money';
import {
  commitRegularisationAction,
  reverseRegularisationAction,
} from '@/server/finance/regularisation-actions';
import type { RegularisationPlan, CommittedRegularisation } from '@/server/finance/regularisation';

/**
 * Régularisation annuelle (I3) — écran syndic. Tant qu'elle n'est pas validée, on montre la
 * PRÉVISUALISATION (provisions appelées vs quote-part réelle, écart par lot) et un bouton pour
 * la figer. Une fois validée, l'état devient un document imprimable, avec annulation possible.
 */
export function RegularisationManager({
  exercice,
  plan,
  committed,
  locale,
}: {
  exercice: number;
  plan: RegularisationPlan;
  committed: CommittedRegularisation | null;
  locale: string;
}) {
  const t = useTranslations('regularisation');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const view = committed ?? plan;
  const fmt = (m: number) => formatMoney(m, locale);
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso),
    );
  const signed = (m: number) => (m > 0 ? `+${fmt(m)}` : fmt(m));

  function commit(): void {
    setError(null);
    const fd = new FormData();
    fd.set('exercice', String(exercice));
    start(async () => {
      const res = await commitRegularisationAction(fd);
      if (res.ok) router.refresh();
      else setError(t(`error.${res.error}`));
    });
  }
  function reverse(): void {
    if (!committed) return;
    if (!window.confirm(t('confirmReverse'))) return;
    setError(null);
    const fd = new FormData();
    fd.set('regularisationId', committed.id);
    start(async () => {
      const res = await reverseRegularisationAction(fd);
      if (res.ok) router.refresh();
      else setError(t(`error.${res.error}`));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barre d'état + actions (masquée à l'impression) */}
      <div className="flex flex-wrap items-center justify-between gap-3" data-print-hide>
        {committed ? (
          <span className="inline-flex items-center gap-2 rounded-md bg-green-soft px-3 py-1.5 text-note font-bold text-green">
            <ShieldCheck className="size-4" aria-hidden />
            {t('committedOn', { date: day(committed.createdAt) })}
          </span>
        ) : (
          <span className="text-note text-label-4">{t('previewHint')}</span>
        )}
        <div className="flex items-center gap-2">
          {committed ? (
            <>
              <Button variant="ghost" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden />
                {t('print')}
              </Button>
              <Button variant="ghost" onClick={reverse} disabled={pending}>
                <RotateCcw className="size-4" aria-hidden />
                {t('reverse')}
              </Button>
            </>
          ) : (
            <Button onClick={commit} loading={pending} disabled={view.lines.length === 0}>
              {t('commit')}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p className="rounded-md bg-orange-soft px-3 py-2 text-note font-semibold text-orange" data-print-hide>
          {error}
        </p>
      )}

      {/* En-tête du document (visible à l'impression) */}
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-section font-bold text-label">{t('docTitle', { exercice })}</h2>
        {committed && (
          <span className="text-note text-label-4">{t('effectiveOn', { date: day(committed.effectiveOn) })}</span>
        )}
      </header>

      {/* Synthèse */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex flex-col gap-0.5 p-4">
          <span className="text-eyebrow font-bold uppercase text-label-4">{t('totalProvisions')}</span>
          <span className="text-stat font-extrabold tabular-nums text-label">
            {fmt(view.totalProvisionsMinor)}
          </span>
        </Card>
        <Card className="flex flex-col gap-0.5 p-4">
          <span className="text-eyebrow font-bold uppercase text-label-4">{t('totalExpenses')}</span>
          <span className="text-stat font-extrabold tabular-nums text-label">
            {fmt(view.totalExpensesMinor)}
          </span>
        </Card>
        <Card className="flex flex-col gap-0.5 p-4">
          <span className="text-eyebrow font-bold uppercase text-label-4">{t('totalAdjustment')}</span>
          <span
            className={`text-stat font-extrabold tabular-nums ${view.totalAdjustmentMinor > 0 ? 'text-orange' : 'text-green'}`}
          >
            {signed(view.totalAdjustmentMinor)}
          </span>
        </Card>
      </div>

      {/* Détail par lot */}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sep text-note uppercase text-label-4">
              <th className="px-4 py-2.5 text-start font-bold">{t('lot')}</th>
              <th className="px-4 py-2.5 text-end font-bold">{t('quotePart')}</th>
              <th className="px-4 py-2.5 text-end font-bold">{t('provisions')}</th>
              <th className="px-4 py-2.5 text-end font-bold">{t('realShare')}</th>
              <th className="px-4 py-2.5 text-end font-bold">{t('balance')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sep">
            {view.lines.map((l) => (
              <tr key={l.lotId}>
                <td className="px-4 py-2.5 font-semibold text-label">{l.reference}</td>
                <td className="px-4 py-2.5 text-end tabular-nums text-label-3">{l.quotePart}</td>
                <td className="px-4 py-2.5 text-end tabular-nums text-label-2">
                  {fmt(l.provisionsMinor)}
                </td>
                <td className="px-4 py-2.5 text-end tabular-nums text-label-2">
                  {fmt(l.quotePartMinor)}
                </td>
                <td className="px-4 py-2.5 text-end tabular-nums">
                  {l.adjustmentMinor === 0 ? (
                    <span className="text-label-4">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className={l.adjustmentMinor > 0 ? 'font-bold text-orange' : 'font-bold text-green'}>
                        {signed(l.adjustmentMinor)}
                      </span>
                      <Badge tone={l.adjustmentMinor > 0 ? 'warning' : 'success'}>
                        {l.adjustmentMinor > 0 ? t('supplement') : t('credit')}
                      </Badge>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-sep font-bold text-label">
              <td className="px-4 py-2.5" colSpan={2}>
                {t('total')}
              </td>
              <td className="px-4 py-2.5 text-end tabular-nums">{fmt(view.totalProvisionsMinor)}</td>
              <td className="px-4 py-2.5 text-end tabular-nums">{fmt(view.totalExpensesMinor)}</td>
              <td className="px-4 py-2.5 text-end tabular-nums">
                <span className={view.totalAdjustmentMinor > 0 ? 'text-orange' : 'text-green'}>
                  {signed(view.totalAdjustmentMinor)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <p className="text-note text-label-4">{t('legend')}</p>
    </div>
  );
}
