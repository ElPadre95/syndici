import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, Plus, Receipt, Landmark } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { ExpenseTable, type ExpenseRowView } from '@/components/finance/ExpenseTable';
import { ExpenseFilters } from '@/components/finance/ExpenseFilters';
import { CategoryBreakdown } from '@/components/finance/CategoryBreakdown';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listExpenses, getExpenseCategories, aggregateByCategory } from '@/server/finance/expenses';
import { getTreasury } from '@/server/finance/treasury';
import { signedFilePath } from '@/server/storage/sign';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Dépenses & transparence (C2). Trésorerie réelle de la période (encaissé − dépensé),
 * répartition par catégorie (« budget »), filtres catégorie/période + recherche
 * fournisseur. Le staff voit tout (dont INTERNE) ; un non-staff ne verrait que PARTAGE.
 */
export default async function DepensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const activeLocale = await getLocale();
  const t = await getTranslations('expenses');
  const sp = await searchParams;

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
  const scopedCtx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const canManage = can(ctx.role, 'expense.manage');

  // Période : par défaut l'année civile en cours ; bornes éditables (URL).
  const year = new Date().getFullYear();
  const defFrom = `${year}-01-01`;
  const defTo = `${year}-12-31`;
  const fromStr = str(sp.from) || defFrom;
  const toStr = str(sp.to) || defTo;
  const from = new Date(`${fromStr}T00:00:00.000Z`);
  const to = new Date(`${toStr}T23:59:59.999Z`);
  const categoryId = str(sp.category);
  const supplier = str(sp.supplier).trim();
  const isFiltered = Boolean(categoryId || supplier) || fromStr !== defFrom || toStr !== defTo;

  const [{ rows: periodRows }, treasury, categories] = await Promise.all([
    listExpenses(scopedCtx, { includeInternal: canManage, from, to }),
    getTreasury(scopedCtx, { from, to }),
    getExpenseCategories(scopedCtx),
  ]);

  // Répartition sur la période (avant le filtrage fin) ; puis on réduit la liste.
  const breakdown = aggregateByCategory(periodRows, t('uncategorized'));
  const supplierLc = supplier.toLowerCase();
  const rows = periodRows.filter(
    (r) =>
      (!categoryId || r.categoryId === categoryId) &&
      (!supplier || (r.supplierName ?? '').toLowerCase().includes(supplierLc)),
  );
  const view: ExpenseRowView[] = rows.map((r) => ({
    ...r,
    justificatifUrl: r.justificatifId ? signedFilePath(r.justificatifId, 3600) : null,
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
          <p className="mt-1 text-sm text-label-3">
            {t('subtitleResidence', { residence: active.name })}
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

      {/* Trésorerie réelle de la période : encaissé − dépensé */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-sep bg-white p-5">
        <div className="flex items-center gap-4">
          <span className="flex size-11 items-center justify-center rounded-md bg-indigo-soft text-indigo">
            <Landmark className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-label-4">
              {t('treasury.title')}
            </p>
            <p
              className={cn(
                'text-3xl font-extrabold tabular-nums',
                treasury.netMinor >= 0 ? 'text-green' : 'text-orange',
              )}
            >
              {formatMoney(treasury.netMinor, activeLocale)}
            </p>
          </div>
        </div>
        <div className="flex gap-6 text-sm">
          <div className="text-end">
            <p className="text-xs font-semibold uppercase tracking-wide text-label-4">
              {t('treasury.collected')}
            </p>
            <p className="font-bold tabular-nums text-green">
              {formatMoney(treasury.collectedMinor, activeLocale)}
            </p>
          </div>
          <div className="text-end">
            <p className="text-xs font-semibold uppercase tracking-wide text-label-4">
              {t('treasury.spent')}
            </p>
            <p className="font-bold tabular-nums text-label">
              −{formatMoney(treasury.spentMinor, activeLocale)}
            </p>
          </div>
        </div>
      </section>

      <ExpenseFilters
        categories={categories}
        current={{ category: categoryId, from: fromStr, to: toStr, supplier }}
        isFiltered={isFiltered}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <CategoryBreakdown breakdown={breakdown} />

        <div className="flex flex-col gap-3">
          {view.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
                <Receipt className="size-6" aria-hidden />
              </span>
              <p className="text-base font-bold text-label">
                {isFiltered ? t('noMatch') : t('emptyTitle')}
              </p>
              <p className="max-w-sm text-sm text-label-3">
                {isFiltered ? t('noMatchBody') : t('emptyBody')}
              </p>
            </div>
          ) : (
            <ExpenseTable rows={view} canManage={canManage} />
          )}
        </div>
      </div>
    </div>
  );
}
