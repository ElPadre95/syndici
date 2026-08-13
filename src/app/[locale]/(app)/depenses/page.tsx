import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, Plus, Receipt } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { ExpenseTable, type ExpenseRowView } from '@/components/finance/ExpenseTable';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listExpenses } from '@/server/finance/expenses';
import { signedFilePath } from '@/server/storage/sign';
import { formatMoney } from '@/lib/money';

/**
 * Dépenses de la résidence (C1). Le staff voit tout (dont les dépenses INTERNE) et peut
 * saisir/annuler ; un non-staff ne verrait que les dépenses PARTAGE. Le justificatif est
 * consultable en un clic (URL signée à durée limitée). Filtres et répartition : C2.
 */
export default async function DepensesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const activeLocale = await getLocale();
  const t = await getTranslations('expenses');

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
  if (!can(ctx.role, 'expense.view')) {
    return (
      <p className="mx-auto max-w-3xl rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
        {t('forbidden')}
      </p>
    );
  }

  const canManage = can(ctx.role, 'expense.manage');
  const { rows, totalNetMinor } = await listExpenses(
    { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role },
    { includeInternal: canManage },
  );
  const view: ExpenseRowView[] = rows.map((r) => ({
    ...r,
    justificatifUrl: r.justificatifId ? signedFilePath(r.justificatifId, 3600) : null,
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
          <p className="mt-1 text-sm text-label-3">
            {t('subtitle', {
              residence: active.name,
              count: rows.filter((r) => !r.isReversal).length,
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-sep bg-white px-4 py-2 text-end">
            <p className="text-xs font-semibold uppercase tracking-wide text-label-4">
              {t('totalSpent')}
            </p>
            <p className="text-xl font-extrabold tabular-nums text-label">
              {formatMoney(totalNetMinor, activeLocale)}
            </p>
          </div>
          {canManage && (
            <Link href="/depenses/nouvelle">
              <Button variant="primary">
                <Plus className="size-4" aria-hidden />
                {t('newCta')}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
            <Receipt className="size-6" aria-hidden />
          </span>
          <p className="text-base font-bold text-label">{t('emptyTitle')}</p>
          <p className="max-w-sm text-sm text-label-3">{t('emptyBody')}</p>
          {canManage && (
            <Link href="/depenses/nouvelle" className="mt-2">
              <Button variant="primary">{t('newCta')}</Button>
            </Link>
          )}
        </div>
      ) : (
        <ExpenseTable rows={view} canManage={canManage} />
      )}
    </div>
  );
}
