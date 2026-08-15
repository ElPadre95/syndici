import { getLocale, getTranslations } from 'next-intl/server';
import { formatMoney } from '@/lib/money';
import type { OwnerMonthlyStatement as Statement } from '@/server/finance/owner';
import type { LedgerEntry } from '@/server/finance/account';

/**
 * Relevé mensuel du propriétaire (H4) imprimable, fr/ar. Sa situation du mois (appels,
 * paiements, frais de retard), son solde à ce jour, et les dépenses visibles de la
 * résidence sur la période. Téléchargement via impression PDF (comme le reçu / le relevé).
 */
export async function OwnerMonthlyStatement({ statement }: { statement: Statement }) {
  const t = await getTranslations('monthly');
  const tAcc = await getTranslations('account');
  const locale = await getLocale();
  const m = (v: number) => formatMoney(v, locale);
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(iso));
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(statement.period.year, statement.period.month - 1, 1),
  );

  const label = (e: LedgerEntry): string => {
    if (e.kind === 'charge')
      return tAcc('label.charge', {
        period: e.periodYear && e.periodMonth
          ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
              new Date(e.periodYear, e.periodMonth - 1, 1),
            )
          : '',
      });
    if (e.kind === 'latefee') return tAcc('label.latefee');
    if (e.kind === 'latefee_reversal') return tAcc('label.latefeeReversal');
    if (e.kind === 'reversal') return tAcc('label.reversal', { method: tAcc(`method.${e.method}`) });
    return tAcc('label.payment', { method: tAcc(`method.${e.method}`) });
  };

  return (
    <article data-print-root className="flex w-full flex-col gap-6 rounded-lg border border-sep bg-white p-8">
      <header className="flex flex-col gap-1 border-b border-sep pb-4">
        {statement.residence.orgName && (
          <p className="text-xs font-bold uppercase tracking-wide text-label-4">{statement.residence.orgName}</p>
        )}
        <p className="text-lg font-extrabold text-label">{statement.residence.name}</p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-extrabold text-label">{t('title', { month: monthLabel })}</h1>
          <p className="text-sm font-semibold text-label-3">
            {t('lotLine', { lot: statement.lotReference })}
            {statement.ownerName ? ` · ${statement.ownerName}` : ''}
          </p>
        </div>
      </header>

      {/* Activité du mois */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-label">{t('activity')}</h2>
        {statement.entries.length === 0 ? (
          <p className="text-sm text-label-4">{t('noActivity')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
                <th className="px-2 py-2 text-start">{tAcc('col.date')}</th>
                <th className="px-2 py-2 text-start">{tAcc('col.label')}</th>
                <th className="px-2 py-2 text-end">{tAcc('col.debit')}</th>
                <th className="px-2 py-2 text-end">{tAcc('col.credit')}</th>
              </tr>
            </thead>
            <tbody>
              {statement.entries.map((e, i) => (
                <tr key={i} className="border-b border-sep last:border-0">
                  <td className="whitespace-nowrap px-2 py-1.5 text-label-3">{day(e.date)}</td>
                  <td className="px-2 py-1.5 text-label">
                    {label(e)}
                    {e.receiptNumber && (
                      <span className="ms-2 font-mono text-xs text-label-4">{e.receiptNumber}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-end tabular-nums text-label">{e.debitMinor ? m(e.debitMinor) : ''}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums text-green">{e.creditMinor ? m(e.creditMinor) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Solde à ce jour */}
      <section className="flex items-center justify-between rounded-md border border-sep bg-bg px-4 py-3">
        <span className="text-sm font-bold uppercase tracking-wide text-label-3">{t('balance')}</span>
        <span
          className={`text-xl font-extrabold tabular-nums ${statement.closingBalanceMinor > 0 ? 'text-orange' : 'text-green'}`}
        >
          {m(statement.closingBalanceMinor)}
        </span>
      </section>

      {/* Dépenses de la résidence sur le mois */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-label">{t('residenceExpenses')}</h2>
        {statement.expenses.length === 0 ? (
          <p className="text-sm text-label-4">{t('noExpenses')}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {statement.expenses.map((e, i) => (
                <tr key={i} className="border-b border-sep last:border-0">
                  <td className="whitespace-nowrap px-2 py-1.5 text-label-3">{day(e.spentOn)}</td>
                  <td className="px-2 py-1.5 text-label">
                    {e.description}
                    {e.categoryLabel ? <span className="text-label-4"> · {e.categoryLabel}</span> : null}
                  </td>
                  <td className="px-2 py-1.5 text-end tabular-nums text-label">{m(e.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </article>
  );
}
