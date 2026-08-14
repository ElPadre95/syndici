import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, BellRing, CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listDunning } from '@/server/finance/dunning';
import { formatMoney } from '@/lib/money';

/**
 * Relances nécessaires (E1). Liste produite par le moteur §7.1 (statuts concernés, seuil
 * de retard, anti-harcèlement), triée par retard décroissant. Les seuils viennent de la
 * `ReminderRule` de la résidence. Réservé au staff (`reminder.manage`). L'envoi est E2.
 */
export default async function RelancesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const activeLocale = await getLocale();
  const t = await getTranslations('relances');

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
  if (!can(ctx.role, 'reminder.manage')) {
    return (
      <p className="mx-auto max-w-3xl rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
        {t('forbidden')}
      </p>
    );
  }

  const { items } = await listDunning({
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
      <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-green-soft text-green">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <p className="text-base font-bold text-label">{t('emptyTitle')}</p>
          <p className="max-w-sm text-sm text-label-3">{t('emptyBody')}</p>
        </div>
      ) : (
        <>
          {/* Bandeau « N résidents à relancer · détection auto » (comme le prototype). */}
          <div className="border-orange/30 flex items-center gap-3 rounded-lg border bg-orange-soft px-4 py-3">
            <BellRing className="size-5 shrink-0 text-orange" aria-hidden />
            <p className="text-sm font-bold text-orange">
              {t('banner', { count: items.length })}
              <span className="text-orange/80 ms-2 font-semibold">{t('autoDetected')}</span>
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-sep bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
                  <th className="px-4 py-2 text-start">{t('col.lot')}</th>
                  <th className="px-4 py-2 text-start">{t('col.payer')}</th>
                  <th className="px-4 py-2 text-end">{t('col.amount')}</th>
                  <th className="px-4 py-2 text-end">{t('col.late')}</th>
                  <th className="px-4 py-2 text-start">{t('col.history')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.lotId} className="border-b border-sep last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/lots/${it.lotId}`}
                        className="font-semibold text-indigo hover:underline"
                      >
                        {it.lotReference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-label">{it.recipientName ?? '—'}</td>
                    <td className="px-4 py-3 text-end font-bold tabular-nums text-label">
                      {formatMoney(it.amountDueMinor, activeLocale)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <span className="rounded-full bg-red-soft px-2 py-0.5 text-xs font-bold text-red">
                        {t('lateDays', { days: it.retardDays })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-label-3">
                      {it.remindersSent === 0
                        ? t('history.never')
                        : t('history.sent', {
                            count: it.remindersSent,
                            date: it.lastReminderAt
                              ? fmtDate.format(new Date(it.lastReminderAt))
                              : '—',
                          })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
