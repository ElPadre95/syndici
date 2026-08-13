import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { ExpenseForm } from '@/components/finance/ExpenseForm';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getExpenseCategories } from '@/server/finance/expenses';

/**
 * Saisie d'une dépense (C1). Réservé au staff (`expense.manage`). Charge les catégories
 * de la résidence (données modifiables, dépendant du type) et rend le formulaire rapide.
 */
export default async function NouvelleDepensePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('expenses');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'expense.manage')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">{t('forbidden')}</p>
      </div>
    );
  }

  const categories = await getExpenseCategories({
    personId: ctx.personId,
    residenceId: ctx.activeId,
    role: ctx.role,
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/depenses">
          <Button variant="ghost">
            <ArrowLeft className="size-4" aria-hidden />
            {t('form.back')}
          </Button>
        </Link>
        <h1 className="text-2xl font-extrabold text-label">{t('form.title')}</h1>
      </div>
      <ExpenseForm categories={categories} />
    </div>
  );
}
