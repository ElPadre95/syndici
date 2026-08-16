import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getBudgetVsActual, listCategoriesWithBudget } from '@/server/finance/budget';
import { getWorksFund } from '@/server/finance/works-fund';
import { BudgetManager } from '@/components/finance/BudgetManager';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/**
 * Budget prévisionnel + fonds de provisions travaux (I2) — syndic. Le budget voté par
 * catégorie et par exercice, le suivi budget/réalisé avec écart, et le fonds travaux
 * (distinct de la trésorerie courante). Réservé au staff (`expense.manage`).
 */
export default async function BudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeC = await getLocale();
  const t = await getTranslations('budget');
  const { year: yearParam } = await searchParams;

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'expense.manage')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('forbidden')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };

  const currentYear = new Date().getUTCFullYear();
  const parsed = Number(yearParam);
  const exercice =
    Number.isInteger(parsed) && parsed >= 2000 && parsed <= currentYear ? parsed : currentYear;
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const [editorRows, vsActual, fund] = await Promise.all([
    listCategoriesWithBudget(actx, exercice),
    getBudgetVsActual(actx, exercice, t('uncategorized'), true),
    getWorksFund(actx, true),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-eyebrow font-bold uppercase text-indigo">{t('eyebrow')}</p>
          <h1 className="text-title text-label">{t('title')}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {years.map((y) => (
            <Link
              key={y}
              href={{ pathname: '/budget', query: { year: y } }}
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1.5 text-note font-bold transition-colors',
                y === exercice
                  ? 'bg-indigo text-white'
                  : 'border border-sep bg-card text-label-2 hover:bg-bg',
              )}
            >
              {y}
            </Link>
          ))}
        </div>
      </header>

      <BudgetManager
        exercice={exercice}
        editorRows={editorRows}
        vsActual={vsActual}
        fund={fund}
        locale={localeC}
      />
    </div>
  );
}
