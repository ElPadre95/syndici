import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarClock, Plus, Building2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listCampaigns } from '@/server/finance/campaigns';
import { formatMoney } from '@/lib/money';

/**
 * Suivi des campagnes d'appels de charges (B1). Une ligne par période : total appelé,
 * encaissé, reste dû, taux de collecte. Réservé au staff (`charge.view.all`).
 */
export default async function ChargesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const activeLocale = await getLocale();
  const t = await getTranslations('charges');

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
  if (!can(ctx.role, 'charge.view.all')) {
    return (
      <p className="mx-auto max-w-3xl rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
        {t('forbidden')}
      </p>
    );
  }

  const campaigns = await listCampaigns({
    personId: ctx.personId,
    residenceId: ctx.activeId,
    role: ctx.role,
  });
  const canManage = can(ctx.role, 'charge.manage');
  const periodLabel = (year: number, month: number) =>
    new Intl.DateTimeFormat(activeLocale, { month: 'long', year: 'numeric' }).format(
      new Date(year, month - 1, 1),
    );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
          <p className="mt-1 text-sm text-label-3">
            {t('subtitle', { residence: active.name, count: campaigns.length })}
          </p>
        </div>
        {canManage && (
          <Link href="/charges/generer">
            <Button variant="primary">
              <Plus className="size-4" aria-hidden />
              {t('generateCta')}
            </Button>
          </Link>
        )}
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
            <CalendarClock className="size-6" aria-hidden />
          </span>
          <p className="text-base font-bold text-label">{t('emptyTitle')}</p>
          <p className="max-w-sm text-sm text-label-3">{t('emptyBody')}</p>
          {canManage && (
            <Link href="/charges/generer" className="mt-2">
              <Button variant="primary">{t('generateCta')}</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sep bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
                <th className="px-4 py-2 text-start">{t('col.period')}</th>
                <th className="px-4 py-2 text-end">{t('col.lots')}</th>
                <th className="px-4 py-2 text-end">{t('col.called')}</th>
                <th className="px-4 py-2 text-end">{t('col.collected')}</th>
                <th className="px-4 py-2 text-end">{t('col.remaining')}</th>
                <th className="px-4 py-2 text-end">{t('col.rate')}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const pct = Math.round(c.collectionRate * 100);
                return (
                  <tr key={`${c.year}-${c.month}`} className="border-b border-sep last:border-0">
                    <td className="px-4 py-3 font-semibold capitalize text-label">
                      {periodLabel(c.year, c.month)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-label-3">{c.lotsCalled}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-label">
                      {formatMoney(c.totalCalledMinor, activeLocale)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-green">
                      {formatMoney(c.totalCollectedMinor, activeLocale)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-label">
                      {formatMoney(c.remainingMinor, activeLocale)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-bg">
                          <span
                            className="block h-full rounded-full bg-green"
                            style={{ inlineSize: `${pct}%` }}
                          />
                        </span>
                        <span className="w-10 text-end font-semibold tabular-nums text-label">
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
