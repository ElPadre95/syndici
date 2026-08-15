'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { upsertCurrencyRateAction } from '@/server/finance/currency-actions';
import type { CurrencyRateView } from '@/server/finance/currency';

const dh = (minor: number) => (minor / 100).toFixed(2);

/**
 * Taux de change indicatifs (H5) — syndic. Saisie MANUELLE (jamais un service externe),
 * avec la date. Liste des taux existants + ajout/mise à jour. Le propriétaire choisira
 * ensuite sa devise parmi ceux-ci.
 */
export function CurrencyRatesForm({ rates }: { rates: CurrencyRateView[] }) {
  const t = useTranslations('currency');
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const today = new Intl.DateTimeFormat('en-CA').format(new Date()); // YYYY-MM-DD

  function save(fd: FormData): void {
    setMsg(null);
    start(async () => {
      const res = await upsertCurrencyRateAction(fd);
      setMsg(res.ok ? t('saved') : t('error'));
      if (res.ok) router.refresh();
    });
  }
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-note text-label-4">{t('rateHint')}</p>

      {rates.length > 0 && (
        <ul className="flex flex-col gap-1">
          {rates.map((r) => (
            <li key={r.currency} className="flex items-center justify-between gap-2 rounded-md bg-bg px-3 py-1.5 text-body">
              <span className="font-bold text-label">{r.currency}</span>
              <span className="tabular-nums text-label-2">
                1 {r.currency} = {dh(r.madPerUnitMinor)} MAD
              </span>
              <span className="text-note text-label-4">{day(r.asOfDate)}</span>
            </li>
          ))}
        </ul>
      )}

      <form action={save} className="flex flex-wrap items-end gap-3">
        <Field name="currency" label={t('currencyCode')} placeholder="EUR" maxLength={3} className="w-24" required />
        <Field name="rate" label={t('madPerUnit')} type="text" inputMode="decimal" placeholder="10.75" className="w-32" required />
        <Field name="asOfDate" label={t('asOfDate')} type="date" defaultValue={today} className="w-40" />
        <Button type="submit" variant="subtle" loading={pending}>
          {t('saveRate')}
        </Button>
        {msg && <span className="text-note font-semibold text-label-3">{msg}</span>}
      </form>
    </div>
  );
}
