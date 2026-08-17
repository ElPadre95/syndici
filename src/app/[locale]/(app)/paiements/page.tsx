import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, Wallet, Receipt as ReceiptIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listResidencePayments } from '@/server/finance/payments';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';

/**
 * Vue globale des paiements de la résidence (B4). Tous les règlements, le plus récent
 * d'abord ; les annulations (écritures inverses) apparaissent en négatif. Réservé au
 * staff (`payment.view.all`).
 */
export default async function PaiementsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const activeLocale = await getLocale();
  const t = await getTranslations('paiements');

  const ctx = await getSessionContext();
  const active = ctx?.residences.find((r) => r.id === ctx.activeId) ?? null;
  if (!ctx?.activeId || !ctx.role || !active) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
          <Building2 className="size-6" aria-hidden />
        </span>
        <p className="text-base font-bold text-label">{t('noActiveTitle')}</p>
        <p className="max-w-sm text-sm text-label-3">{t('noActiveBody')}</p>
      </div>
    );
  }
  if (!can(ctx.role, 'payment.view.all')) {
    return (
      <p className="mx-auto max-w-3xl rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
        {t('forbidden')}
      </p>
    );
  }

  const { rows, totalNetMinor, count } = await listResidencePayments({
    personId: ctx.personId,
    residenceId: ctx.activeId,
    role: ctx.role,
  });
  const fmtDate = new Intl.DateTimeFormat(activeLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
          <p className="mt-1 text-sm text-label-3">
            {t('subtitle', { residence: active.name, count })}
          </p>
        </div>
        <div className="rounded-lg border border-sep bg-white px-4 py-2 text-end">
          <p className="text-xs font-semibold uppercase tracking-wide text-label-4">
            {t('netCollected')}
          </p>
          <p className="text-xl font-extrabold tabular-nums text-green">
            {formatMoney(totalNetMinor, activeLocale)}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
            <Wallet className="size-6" aria-hidden />
          </span>
          <p className="text-base font-bold text-label">{t('emptyTitle')}</p>
          <p className="max-w-sm text-sm text-label-3">{t('emptyBody')}</p>
        </div>
      ) : (
        <div
          data-shot="paiements"
          className="overflow-x-auto rounded-lg border border-sep bg-white"
        >
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
                <th className="px-4 py-2 text-start">{t('col.date')}</th>
                <th className="px-4 py-2 text-start">{t('col.lot')}</th>
                <th className="px-4 py-2 text-start">{t('col.payer')}</th>
                <th className="px-4 py-2 text-start">{t('col.method')}</th>
                <th className="px-4 py-2 text-start">{t('col.receipt')}</th>
                <th className="px-4 py-2 text-end">{t('col.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-sep last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-label-3">
                    {fmtDate.format(new Date(r.receivedAt))}
                  </td>
                  <td className="px-4 py-3">
                    {r.lotId ? (
                      <Link
                        href={`/lots/${r.lotId}`}
                        className="font-semibold text-indigo hover:underline"
                      >
                        {r.lotReference}
                      </Link>
                    ) : (
                      <span className="text-label-4">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-label">{r.payerName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-label-3">{t(`method.${r.method}`)}</span>
                    {r.isReversal && (
                      <span className="ms-2 rounded-full bg-orange-soft px-2 py-0.5 text-xs font-bold text-orange">
                        {t('reversal')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.receiptNumber && r.receiptId ? (
                      <Link
                        href={`/recus/${r.receiptId}`}
                        className={cn(
                          'flex items-center gap-1 font-mono text-xs font-semibold',
                          r.receiptVoided
                            ? 'text-label-4 line-through'
                            : 'text-indigo hover:underline',
                        )}
                      >
                        <ReceiptIcon className="size-3.5" aria-hidden />
                        {r.receiptNumber}
                      </Link>
                    ) : (
                      <span className="text-label-4">—</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-end font-bold tabular-nums',
                      r.isReversal ? 'text-orange' : 'text-label',
                      r.reversed && 'text-label-4 line-through',
                    )}
                  >
                    {formatMoney(r.amountMinor, activeLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
