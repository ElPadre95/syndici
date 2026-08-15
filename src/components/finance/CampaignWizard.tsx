'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { CalendarClock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { previewCampaignAction, generateCampaignAction } from '@/server/finance/campaign-actions';
import type { CampaignPreview, CampaignGenResult } from '@/server/finance/campaigns';
import type { CampaignActionError } from '@/server/finance/campaign-action-types';

const FILE_ERRORS = new Set(['invalid_period', 'not_found']);

/**
 * Assistant de génération d'une campagne d'appels (B1) : choisir une période, voir
 * l'aperçu (rien n'est écrit), puis confirmer. La génération est idempotente.
 */
export function CampaignWizard() {
  const t = useTranslations('charges.generate');
  const locale = useLocale();
  const nowRef = useState(() => new Date())[0];
  const [year, setYear] = useState(nowRef.getFullYear());
  const [month, setMonth] = useState(nowRef.getMonth() + 1);
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [report, setReport] = useState<CampaignGenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, i, 1)),
      })),
    [locale],
  );
  const years = useMemo(() => {
    const y = nowRef.getFullYear();
    return [y - 1, y, y + 1];
  }, [nowRef]);

  const errorLabel = (code: CampaignActionError): string =>
    FILE_ERRORS.has(code)
      ? t(`error.${code}`)
      : code === 'forbidden'
        ? t('forbidden')
        : t('noResidence');

  const runPreview = () => {
    setReport(null);
    setError(null);
    start(async () => {
      const res = await previewCampaignAction(year, month);
      if (res.ok) setPreview(res.preview);
      else {
        setPreview(null);
        setError(errorLabel(res.error));
      }
    });
  };

  const confirm = () => {
    setError(null);
    start(async () => {
      const res = await generateCampaignAction(year, month);
      if (res.ok) {
        setReport(res.result);
        setPreview(null);
      } else setError(errorLabel(res.error));
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-indigo-soft text-indigo">
              <CalendarClock className="size-5" aria-hidden />
            </span>
            <div className="flex-1">
              <h2 className="text-base font-bold text-label">{t('periodTitle')}</h2>
              <p className="mt-1 text-sm text-label-3">{t('periodHint')}</p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-label-3">{t('month')}</span>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="rounded-md border border-sep bg-white px-3 py-2 text-sm"
                  >
                    {months.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-label-3">{t('year')}</span>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="rounded-md border border-sep bg-white px-3 py-2 text-sm"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="primary" onClick={runPreview} disabled={pending}>
                  {t('previewCta')}
                </Button>
                {pending && (
                  <span className="text-sm text-label-3">
                    {report ? t('generating') : t('analyzing')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-orange-soft px-4 py-3 text-sm font-semibold text-orange">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {preview && !report && (
        <PreviewTable preview={preview} onConfirm={confirm} pending={pending} locale={locale} />
      )}

      {report && (
        <Card>
          <div className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-label">
              <CheckCircle2 className="size-5 text-green" aria-hidden />
              {t('report.title')}
            </h2>
            <ul className="flex flex-col gap-1 text-sm text-label-3">
              <li>{t('report.created', { count: report.created })}</li>
              <li>{t('report.skipped', { count: report.skipped })}</li>
              <li>
                {t('report.total', { amount: formatMoney(report.totalCreatedMinor, locale) })}
              </li>
            </ul>
            <div>
              <Link href="/charges">
                <Button variant="primary">{t('report.back')}</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function PreviewTable({
  preview,
  onConfirm,
  pending,
  locale,
}: {
  preview: CampaignPreview;
  onConfirm: () => void;
  pending: boolean;
  locale: string;
}) {
  const t = useTranslations('charges.generate');
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-label">
              {t('preview.title')}
              <span className="rounded-full bg-indigo-soft px-2 py-0.5 text-xs font-bold text-indigo">
                {t(preview.mode === 'TANTIEMES' ? 'preview.modeTantiemes' : 'preview.modeForfait')}
              </span>
            </h2>
            <p className="mt-1 text-sm text-label-3">
              {t('preview.summary', {
                toCall: preview.toCallCount,
                already: preview.alreadyCalledCount,
                total: formatMoney(preview.totalToCallMinor, locale),
              })}
            </p>
            {preview.mode === 'TANTIEMES' && (
              <p className="mt-1 text-xs text-label-4">
                {t('preview.tantiemesHint', { total: preview.totalQuotePart })}
              </p>
            )}
          </div>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={pending || preview.toCallCount === 0}
          >
            {t('preview.confirm', { count: preview.toCallCount })}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-sep">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
                <th className="px-3 py-2 text-start">{t('preview.colRef')}</th>
                <th className="px-3 py-2 text-start">{t('preview.colPayer')}</th>
                {preview.mode === 'TANTIEMES' && (
                  <th className="px-3 py-2 text-end">{t('preview.colQuote')}</th>
                )}
                <th className="px-3 py-2 text-end">{t('preview.colAmount')}</th>
                <th className="px-3 py-2 text-start">{t('preview.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((l) => (
                <tr key={l.lotId} className="border-b border-sep last:border-0">
                  <td className="px-3 py-2 font-semibold text-label">{l.reference}</td>
                  <td className="px-3 py-2 text-label-3">{l.payerName ?? '—'}</td>
                  {preview.mode === 'TANTIEMES' && (
                    <td className="px-3 py-2 text-end tabular-nums text-label-3">
                      {l.quotePart}/{preview.totalQuotePart}
                    </td>
                  )}
                  <td className="px-3 py-2 text-end tabular-nums text-label">
                    {formatMoney(l.amountMinor, locale)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-bold',
                        l.alreadyCalled ? 'bg-bg text-label-3' : 'bg-green-soft text-green',
                      )}
                    >
                      {t(l.alreadyCalled ? 'preview.statusAlready' : 'preview.statusToCall')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
