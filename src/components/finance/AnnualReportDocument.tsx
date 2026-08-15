import { getLocale, getTranslations } from 'next-intl/server';
import { formatMoney } from '@/lib/money';
import type { AnnualReport } from '@/server/finance/annual';

/**
 * Bilan annuel (H3) imprimable, fr/ar — comme le reçu. État comptable d'exercice à
 * distribuer en assemblée. Un avertissement explicite : ce n'est PAS un procès-verbal.
 */
export async function AnnualReportDocument({ report }: { report: AnnualReport }) {
  const t = await getTranslations('annual');
  const locale = await getLocale();
  const m = (v: number) => formatMoney(v, locale);
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

  const Fig = ({ label, value, accent }: { label: string; value: number; accent?: 'orange' | 'green' }) => (
    <div className="flex flex-col gap-0.5 rounded-md border border-sep p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-label-4">{label}</span>
      <span
        className={`text-lg font-extrabold tabular-nums ${accent === 'orange' ? 'text-orange' : accent === 'green' ? 'text-green' : 'text-label'}`}
      >
        {m(value)}
      </span>
    </div>
  );

  return (
    <article data-print-root className="flex w-full flex-col gap-6 rounded-lg border border-sep bg-white p-8">
      <header className="flex flex-col gap-1 border-b border-sep pb-4">
        {report.residence.orgName && (
          <p className="text-xs font-bold uppercase tracking-wide text-label-4">{report.residence.orgName}</p>
        )}
        <p className="text-lg font-extrabold text-label">
          {report.residence.name}
          {report.residence.city ? ` · ${report.residence.city}` : ''}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-label">{t('title', { year: report.exercice })}</h1>
        <p className="text-xs text-label-4">{t('disclaimer')}</p>
      </header>

      {/* Chiffres d'exercice + positions à ce jour */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Fig label={t('called')} value={report.calledMinor} />
        <Fig label={t('collected')} value={report.collectedMinor} accent="green" />
        <Fig label={t('spent')} value={report.spentMinor} />
        <Fig label={t('lateFees')} value={report.lateFeeMinor} />
        <Fig label={t('outstanding')} value={report.outstandingMinor} accent="orange" />
        <Fig label={t('treasury')} value={report.treasuryMinor} accent="green" />
      </section>

      {/* Dépenses par catégorie */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-label">{t('byCategory')}</h2>
        {report.categories.length === 0 ? (
          <p className="text-sm text-label-4">{t('none')}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {report.categories.map((c) => (
                <tr key={c.label} className="border-b border-sep last:border-0">
                  <td className="px-2 py-1.5 text-label">{c.label}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums text-label">{m(c.totalMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Contrats en cours */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-label">{t('contracts')}</h2>
        {report.contracts.length === 0 ? (
          <p className="text-sm text-label-4">{t('none')}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {report.contracts.map((c) => (
                <tr key={c.id} className="border-b border-sep last:border-0">
                  <td className="px-2 py-1.5 text-label">
                    {c.name}
                    {c.supplierName ? <span className="text-label-4"> · {c.supplierName}</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-label-3">{day(c.endDate)}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums text-label">
                    {c.amountMinor != null ? m(c.amountMinor) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Situation lot par lot */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-label">{t('byLot')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
                <th className="px-2 py-2 text-start">{t('lot')}</th>
                <th className="px-2 py-2 text-end">{t('called')}</th>
                <th className="px-2 py-2 text-end">{t('paid')}</th>
                <th className="px-2 py-2 text-end">{t('lateFees')}</th>
                <th className="px-2 py-2 text-end">{t('remaining')}</th>
              </tr>
            </thead>
            <tbody>
              {report.lots.map((l) => (
                <tr key={l.reference} className="border-b border-sep last:border-0">
                  <td className="px-2 py-1.5 font-semibold text-label">{l.reference}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums text-label-3">{m(l.calledMinor)}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums text-green">{m(l.paidMinor)}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums text-label-3">
                    {l.lateFeeMinor ? m(l.lateFeeMinor) : ''}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-end font-semibold tabular-nums ${l.remainingMinor > 0 ? 'text-orange' : 'text-label'}`}
                  >
                    {m(l.remainingMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  );
}
