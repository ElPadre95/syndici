'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { AlertCircle, Plus, Archive, CalendarClock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { recordContractAction, archiveContractAction } from '@/server/finance/contract-actions';
import type { ContractView, ContractFrequency } from '@/server/finance/contracts';

const TIER_TONE: Record<string, string> = {
  expired: 'bg-red-soft text-red',
  soon: 'bg-orange-soft text-orange',
  ok: 'bg-green-soft text-green',
};
const FREQUENCIES: readonly ContractFrequency[] = [
  'MENSUEL',
  'TRIMESTRIEL',
  'SEMESTRIEL',
  'ANNUEL',
];

/** Contrats fournisseurs (C3) : échéance, compte à rebours coloré, saisie et archivage. */
export function ContractsPanel({
  contracts,
  canManage,
}: {
  contracts: ContractView[];
  canManage: boolean;
}) {
  const t = useTranslations('contracts');
  const locale = useLocale();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fmtDate = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const countdownLabel = (c: ContractView): string => {
    if (c.tier === 'expired') return t('countdown.expired');
    if (c.daysUntil === 0) return t('countdown.today');
    return t('countdown.days', { days: c.daysUntil });
  };

  const submitCreate = (form: HTMLFormElement) => {
    setError(null);
    const fd = new FormData(form);
    start(async () => {
      const res = await recordContractAction(fd);
      if (res.ok) {
        setShowForm(false);
        form.reset();
        router.refresh();
      } else setError(t(`error.${res.error}`));
    });
  };

  const archive = (contractId: string) => {
    setError(null);
    const fd = new FormData();
    fd.set('contractId', contractId);
    start(async () => {
      const res = await archiveContractAction(fd);
      if (res.ok) router.refresh();
      else setError(t(`error.${res.error}`));
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
          <p className="mt-1 text-sm text-label-3">{t('subtitle')}</p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-4" aria-hidden />
            {t('newCta')}
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {showForm && canManage && (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitCreate(e.currentTarget);
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('form.name')}</span>
                <input name="name" className="rounded-md border border-sep px-3 py-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('form.supplier')}</span>
                <input
                  name="supplierName"
                  className="rounded-md border border-sep px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('form.amount')}</span>
                <input
                  name="amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  className="rounded-md border border-sep px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('form.frequency')}</span>
                <select
                  name="frequency"
                  defaultValue="ANNUEL"
                  className="rounded-md border border-sep bg-white px-3 py-2 text-sm"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {t(`frequency.${f}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('form.startDate')}</span>
                <input
                  name="startDate"
                  type="date"
                  className="rounded-md border border-sep px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('form.endDate')}</span>
                <input
                  name="endDate"
                  type="date"
                  className="rounded-md border border-sep px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={pending}>
                {t('form.save')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                {t('form.cancel')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {contracts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
            <CalendarClock className="size-6" aria-hidden />
          </span>
          <p className="text-base font-bold text-label">{t('emptyTitle')}</p>
          <p className="max-w-sm text-sm text-label-3">{t('emptyBody')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {contracts.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-label">{c.name}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-bold',
                        TIER_TONE[c.tier],
                      )}
                    >
                      {countdownLabel(c)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-label-3">
                    {[
                      c.supplierName,
                      t(`frequency.${c.frequency}`),
                      t('due', { date: fmtDate.format(new Date(c.endDate)) }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {c.amountMinor != null && (
                    <span className="text-lg font-extrabold tabular-nums text-label">
                      {formatMoney(c.amountMinor, locale)}
                    </span>
                  )}
                  {canManage && (
                    <Button variant="ghost" onClick={() => archive(c.id)} disabled={pending}>
                      <Archive className="size-4" aria-hidden />
                      {t('archive')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </section>
  );
}
