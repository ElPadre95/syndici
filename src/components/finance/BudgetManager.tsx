'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Paperclip, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/money';
import {
  setBudgetLineAction,
  addWorksFundContributionAction,
  reverseWorksFundContributionAction,
} from '@/server/finance/i2-actions';
import type { BudgetVsActual } from '@/server/finance/budget';
import type { CategoryBudget } from '@/server/finance/budget';
import type { WorksFundView } from '@/server/finance/works-fund';

const dh = (minor: number) => (minor / 100).toFixed(2);

/** Une ligne éditable du budget prévisionnel (une catégorie, un exercice). */
function BudgetRow({ exercice, category }: { exercice: number; category: CategoryBudget }) {
  const t = useTranslations('budget');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(fd: FormData): void {
    setSaved(false);
    fd.set('exercice', String(exercice));
    fd.set('categoryId', category.id);
    start(async () => {
      const res = await setBudgetLineAction(fd);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <form action={save} className="flex items-center gap-2 py-1.5">
      <span className="min-w-0 flex-1 truncate text-body text-label">{category.label}</span>
      <input
        name="amount"
        inputMode="decimal"
        defaultValue={dh(category.budgetedMinor)}
        aria-label={`${t('budgeted')} — ${category.label}`}
        className="w-28 rounded-md border border-sep px-2.5 py-1.5 text-end text-sm tabular-nums"
      />
      <Button type="submit" variant="ghost" loading={pending} className="shrink-0">
        {saved ? t('saved') : t('save')}
      </Button>
    </form>
  );
}

/** Formulaire d'appel au fonds travaux. */
function AddContribution() {
  const t = useTranslations('worksFund');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  function add(fd: FormData): void {
    setError(null);
    start(async () => {
      const res = await addWorksFundContributionAction(fd);
      if (res.ok) router.refresh();
      else setError(t(`error.${res.error}`));
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-body font-bold text-label">{t('addTitle')}</h3>
      <form action={add} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-label-3">{t('label')}</span>
          <input
            name="label"
            placeholder={t('labelHint')}
            className="rounded-md border border-sep px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-label-3">{t('amount')}</span>
            <input
              name="amount"
              inputMode="decimal"
              placeholder="0,00"
              className="rounded-md border border-sep px-3 py-2 text-sm tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-label-3">{t('date')}</span>
            <input
              name="occurredOn"
              type="date"
              defaultValue={today}
              className="rounded-md border border-sep px-3 py-2 text-sm"
            />
          </label>
        </div>
        {error && <p className="text-note font-semibold text-orange">{error}</p>}
        <Button type="submit" loading={pending} className="self-start">
          {t('add')}
        </Button>
      </form>
    </Card>
  );
}

/** Bouton d'annulation d'un appel (écriture inverse). */
function ReverseButton({ contributionId }: { contributionId: string }) {
  const t = useTranslations('worksFund');
  const router = useRouter();
  const [pending, start] = useTransition();

  function reverse(): void {
    if (!window.confirm(t('confirmReverse'))) return;
    const fd = new FormData();
    fd.set('contributionId', contributionId);
    start(async () => {
      const res = await reverseWorksFundContributionAction(fd);
      if (res.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={reverse}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-note font-bold text-label-3 hover:bg-bg disabled:opacity-50"
    >
      <RotateCcw className="size-3.5" aria-hidden />
      {t('reverse')}
    </button>
  );
}

/**
 * Budget prévisionnel + fonds travaux (I2) — écran syndic. Éditeur du budget voté par
 * catégorie, tableau budget/réalisé avec écart, et fonds de provisions travaux (solde,
 * appels, dépenses imputées) — strictement distinct de la trésorerie courante.
 */
export function BudgetManager({
  exercice,
  editorRows,
  vsActual,
  fund,
  locale,
}: {
  exercice: number;
  editorRows: CategoryBudget[];
  vsActual: BudgetVsActual;
  fund: WorksFundView;
  locale: string;
}) {
  const t = useTranslations('budget');
  const tf = useTranslations('worksFund');
  const fmt = (m: number) => formatMoney(m, locale);
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso),
    );

  return (
    <div className="flex flex-col gap-8">
      {/* Éditeur du budget voté */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-section font-bold text-label">{t('editorTitle')}</h2>
          <p className="text-note text-label-4">{t('editorHint')}</p>
        </div>
        <Card className="flex flex-col divide-y divide-sep">
          {editorRows.map((c) => (
            <BudgetRow key={c.id} exercice={exercice} category={c} />
          ))}
        </Card>
      </section>

      {/* Budget contre réalisé */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-section font-bold text-label">{t('vsActualTitle')}</h2>
          <p className="text-note text-label-4">{t('vsActualHint')}</p>
        </div>
        {vsActual.lines.length === 0 ? (
          <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">
            {t('noBudget')}
          </p>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sep text-start text-note uppercase text-label-4">
                  <th className="px-4 py-2.5 text-start font-bold">{t('category')}</th>
                  <th className="px-4 py-2.5 text-end font-bold">{t('budgeted')}</th>
                  <th className="px-4 py-2.5 text-end font-bold">{t('realized')}</th>
                  <th className="px-4 py-2.5 text-end font-bold">{t('ecart')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sep">
                {vsActual.lines.map((l) => (
                  <tr key={l.categoryId ?? 'none'}>
                    <td className="px-4 py-2.5 text-label">{l.label}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-label-2">
                      {fmt(l.budgetedMinor)}
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-label-2">
                      {fmt(l.realizedMinor)}
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums">
                      <span className={l.ecartMinor < 0 ? 'font-bold text-orange' : 'text-green'}>
                        {fmt(l.ecartMinor)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-sep font-bold text-label">
                  <td className="px-4 py-2.5">{t('total')}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">
                    {fmt(vsActual.totalBudgetedMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums">
                    {fmt(vsActual.totalRealizedMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums">
                    <span className={vsActual.totalEcartMinor < 0 ? 'text-orange' : 'text-green'}>
                      {fmt(vsActual.totalEcartMinor)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>
        )}
      </section>

      {/* Fonds de provisions travaux */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-section font-bold text-label">{tf('title')}</h2>
          <p className="text-note text-label-4">{tf('hint')}</p>
        </div>

        <Card className="flex flex-wrap items-center justify-between gap-4 bg-green p-6 text-white">
          <div>
            <p className="text-eyebrow font-bold uppercase text-white/70">{tf('balance')}</p>
            <p className="mt-1 text-display font-extrabold tabular-nums">{fmt(fund.balanceMinor)}</p>
          </div>
          <div className="flex gap-6 text-body">
            <div>
              <p className="text-eyebrow font-semibold uppercase text-white/60">{tf('contributed')}</p>
              <p className="font-bold tabular-nums">{fmt(fund.contributedMinor)}</p>
            </div>
            <div>
              <p className="text-eyebrow font-semibold uppercase text-white/60">{tf('spent')}</p>
              <p className="font-bold tabular-nums">−{fmt(fund.spentMinor)}</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AddContribution />

          <div className="flex flex-col gap-3">
            <h3 className="text-body font-bold text-label">{tf('contributionsTitle')}</h3>
            {fund.contributions.length === 0 ? (
              <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">
                {tf('noContributions')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {fund.contributions.map((c) => (
                  <li key={c.id}>
                    <Card className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-semibold text-label">{c.label}</p>
                        <p className="text-note text-label-4">{day(c.occurredOn)}</p>
                      </div>
                      <span
                        className={`font-bold tabular-nums ${c.amountMinor < 0 ? 'text-orange' : 'text-label-2'}`}
                      >
                        {fmt(c.amountMinor)}
                      </span>
                      {c.isReversal ? (
                        <Badge tone="neutral">{tf('reversalOf')}</Badge>
                      ) : c.reversed ? (
                        <Badge tone="neutral">{tf('reversed')}</Badge>
                      ) : (
                        <ReverseButton contributionId={c.id} />
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Dépenses imputées au fonds */}
        <div className="flex flex-col gap-3">
          <h3 className="text-body font-bold text-label">{tf('expensesTitle')}</h3>
          {fund.expenses.length === 0 ? (
            <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">
              {tf('noExpenses')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {fund.expenses.map((e) => (
                <li key={e.id}>
                  <Card className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-label">{e.description}</p>
                      <p className="text-note text-label-4">
                        {day(e.spentOn)}
                        {e.categoryLabel ? ` · ${e.categoryLabel}` : ''}
                      </p>
                    </div>
                    <span className="font-bold tabular-nums text-label-2">{fmt(e.amountMinor)}</span>
                    {e.justificatifHref && (
                      <a
                        href={e.justificatifHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-soft px-2.5 py-1.5 text-note font-bold text-indigo hover:bg-indigo-mid"
                      >
                        <Paperclip className="size-3.5" aria-hidden />
                        {tf('justificatif')}
                      </a>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
