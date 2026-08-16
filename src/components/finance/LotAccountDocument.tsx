import { getLocale, getTranslations } from 'next-intl/server';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import type { LotAccount, LedgerEntry } from '@/server/finance/account';

/**
 * Relevé de compte d'un lot (B4), imprimable fr/ar. Débit / crédit / solde courant,
 * ordre chronologique, solde de clôture = reste dû. Le chrome de l'app est masqué à
 * l'impression (data-print-hide sur les contrôles).
 */
export async function LotAccountDocument({ account }: { account: LotAccount }) {
  const t = await getTranslations('account');
  const locale = await getLocale();
  const fmtDate = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const period = (e: LedgerEntry) =>
    e.periodYear && e.periodMonth
      ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
          new Date(e.periodYear, e.periodMonth - 1, 1),
        )
      : '';

  const label = (e: LedgerEntry): string => {
    if (e.kind === 'charge') return t('label.charge', { period: period(e) });
    if (e.kind === 'latefee') return t('label.latefee');
    if (e.kind === 'latefee_reversal') return t('label.latefeeReversal');
    if (e.kind === 'regularisation') return t('label.regularisation', { exercice: e.periodYear ?? '' });
    if (e.kind === 'reversal') return t('label.reversal', { method: t(`method.${e.method}`) });
    return t('label.payment', { method: t(`method.${e.method}`) });
  };

  return (
    <article
      data-print-root
      className="flex w-full flex-col gap-6 rounded-lg border border-sep bg-white p-8"
    >
      <header className="flex flex-col gap-1 border-b border-sep pb-4">
        {account.residence.orgName && (
          <p className="text-xs font-bold uppercase tracking-wide text-label-4">
            {account.residence.orgName}
          </p>
        )}
        <p className="text-lg font-extrabold text-label">{account.residence.name}</p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-extrabold text-label">{t('title')}</h1>
          <p className="text-sm font-semibold text-label-3">
            {t('lotLine', { lot: account.lotReference })}
            {account.ownerName ? ` · ${account.ownerName}` : ''}
          </p>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
              <th className="px-2 py-2 text-start">{t('col.date')}</th>
              <th className="px-2 py-2 text-start">{t('col.label')}</th>
              <th className="px-2 py-2 text-end">{t('col.debit')}</th>
              <th className="px-2 py-2 text-end">{t('col.credit')}</th>
              <th className="px-2 py-2 text-end">{t('col.balance')}</th>
            </tr>
          </thead>
          <tbody>
            {account.entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-label-3">
                  {t('empty')}
                </td>
              </tr>
            )}
            {account.entries.map((e, i) => (
              <tr key={i} className="border-b border-sep last:border-0">
                <td className="whitespace-nowrap px-2 py-2 text-label-3">
                  {fmtDate.format(new Date(e.date))}
                </td>
                <td className="px-2 py-2 text-label">
                  {label(e)}
                  {e.receiptNumber && (
                    <span
                      className={cn(
                        'ms-2 font-mono text-xs',
                        e.receiptVoided ? 'text-label-4 line-through' : 'text-label-4',
                      )}
                    >
                      {e.receiptNumber}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-end tabular-nums text-label">
                  {e.debitMinor ? formatMoney(e.debitMinor, locale) : ''}
                </td>
                <td className="px-2 py-2 text-end tabular-nums text-green">
                  {e.creditMinor ? formatMoney(e.creditMinor, locale) : ''}
                </td>
                <td className="px-2 py-2 text-end font-semibold tabular-nums text-label">
                  {formatMoney(e.balanceMinor, locale)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-sep font-bold">
              <td className="px-2 py-3" colSpan={2}>
                {t('closingBalance')}
              </td>
              <td className="px-2 py-3 text-end tabular-nums text-label-3">
                {formatMoney(account.totalDebitMinor, locale)}
              </td>
              <td className="px-2 py-3 text-end tabular-nums text-label-3">
                {formatMoney(account.totalCreditMinor, locale)}
              </td>
              <td
                className={cn(
                  'px-2 py-3 text-end text-base tabular-nums',
                  account.balanceMinor > 0 ? 'text-orange' : 'text-green',
                )}
              >
                {formatMoney(account.balanceMinor, locale)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  );
}
