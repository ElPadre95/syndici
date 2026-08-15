import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getAnnualReport } from '@/server/finance/annual';
import { AnnualReportDocument } from '@/components/finance/AnnualReportDocument';
import { PrintButton } from '@/components/finance/PrintButton';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/**
 * Bilan annuel (H3) — syndic. État comptable d'exercice, imprimable, à distribuer en
 * assemblée. Réservé au staff (`charge.view.all`). Le seed vit sur l'année courante ;
 * on propose l'exercice courant et les deux précédents.
 */
export default async function BilanPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('annual');
  const { year: yearParam } = await searchParams;

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'charge.view.all')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('forbidden')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };

  const currentYear = new Date().getUTCFullYear();
  const parsed = Number(yearParam);
  const exercice = Number.isInteger(parsed) && parsed >= 2000 && parsed <= currentYear ? parsed : currentYear;
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const report = await getAnnualReport(actx, exercice, t('uncategorized'));
  if (!report) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-bg px-3 py-2 text-body text-label-3">{t('forbidden')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3" data-print-hide>
        <div className="flex flex-wrap gap-2">
          {years.map((y) => (
            <Link
              key={y}
              href={{ pathname: '/bilan', query: { year: y } }}
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1.5 text-note font-bold transition-colors',
                y === exercice ? 'bg-indigo text-white' : 'border border-sep bg-card text-label-2 hover:bg-bg',
              )}
            >
              {y}
            </Link>
          ))}
        </div>
        <PrintButton label={t('print')} />
      </div>
      <AnnualReportDocument report={report} />
    </div>
  );
}
