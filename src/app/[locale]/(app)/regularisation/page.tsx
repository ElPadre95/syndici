import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { previewRegularisation, getRegularisation } from '@/server/finance/regularisation';
import { RegularisationManager } from '@/components/finance/RegularisationManager';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/**
 * Régularisation annuelle (I3) — syndic. Confronte les provisions appelées d'un exercice à la
 * quote-part réelle des dépenses courantes (réparties aux tantièmes) et fige l'écart par lot.
 * Réservé au staff (`expense.manage`). Non obligatoire : déclenchée manuellement, réversible.
 */
export default async function RegularisationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeC = await getLocale();
  const t = await getTranslations('regularisation');
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

  const committed = await getRegularisation(actx, exercice);
  // La prévisualisation ne sert que tant qu'aucune régularisation n'est figée pour l'exercice.
  const plan = committed ?? (await previewRegularisation(actx, exercice));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3" data-print-hide>
        <div>
          <p className="text-eyebrow font-bold uppercase text-indigo">{t('eyebrow')}</p>
          <h1 className="text-title text-label">{t('title')}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {years.map((y) => (
            <Link
              key={y}
              href={{ pathname: '/regularisation', query: { year: y } }}
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

      <RegularisationManager
        exercice={exercice}
        plan={plan}
        committed={committed}
        locale={localeC}
      />
    </div>
  );
}
