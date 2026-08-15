import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Home } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { cn } from '@/lib/cn';
import { Link } from '@/i18n/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { PrintButton } from '@/components/finance/PrintButton';
import { OwnerMonthlyStatement } from '@/components/finance/OwnerMonthlyStatement';
import { listOwnerLots, getOwnerMonthlyStatement } from '@/server/finance/owner';

/**
 * Relevé mensuel (H4) — propriétaire. Un document téléchargeable (impression PDF) : sa
 * situation du mois, ses appels/paiements/frais, son solde, et les dépenses visibles de la
 * résidence sur la période. Réservé au rôle PROPRIETAIRE ; scopé à ses lots (lecture
 * owner-safe). Le lot et le mois passent par l'URL.
 */
export default async function OwnerMonthlyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ lot?: string; month?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeC = await getLocale();
  const { lot: lotParam, month: monthParam } = await searchParams;
  const t = await getTranslations('monthly');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'payment.view.own')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('forbidden')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };

  const lots = await listOwnerLots(actx);
  if (lots.length === 0) return <EmptyState Icon={Home} title={t('noLots')} />;
  const activeLot = lots.find((l) => l.lotId === lotParam) ?? lots[0]!;

  // Mois : par défaut le mois courant ; sinon "YYYY-MM" depuis l'URL.
  const now = new Date();
  const parsed = /^(\d{4})-(\d{2})$/.exec(monthParam ?? '');
  const year = parsed ? Number(parsed[1]) : now.getUTCFullYear();
  const month = parsed ? Number(parsed[2]) : now.getUTCMonth() + 1;

  // Trois derniers mois pour le sélecteur.
  const months = [0, 1, 2].map((back) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    return { key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1 };
  });
  const monthName = (y: number, mo: number) =>
    new Intl.DateTimeFormat(localeC, { month: 'long', year: 'numeric' }).format(new Date(y, mo - 1, 1));

  const statement = await getOwnerMonthlyStatement(actx, activeLot.lotId, year, month);
  if (statement) statement.ownerName = ctx.userLabel;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header data-print-hide>
        <p className="text-eyebrow font-bold uppercase text-indigo">{t('eyebrow')}</p>
        <h1 className="text-title text-label">{t('pageTitle')}</h1>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3" data-print-hide>
        <div className="flex flex-wrap gap-2">
          {lots.length > 1 &&
            lots.map((l) => (
              <Link
                key={l.lotId}
                href={{ pathname: '/proprietaire/releve', query: { lot: l.lotId, month: `${year}-${String(month).padStart(2, '0')}` } }}
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1.5 text-note font-bold transition-colors',
                  l.lotId === activeLot.lotId ? 'bg-indigo text-white' : 'border border-sep bg-card text-label-2 hover:bg-bg',
                )}
              >
                {l.reference}
              </Link>
            ))}
        </div>
        <PrintButton label={t('download')} />
      </div>

      <div className="flex flex-wrap gap-2" data-print-hide>
        {months.map((mm) => (
          <Link
            key={mm.key}
            href={{ pathname: '/proprietaire/releve', query: { lot: activeLot.lotId, month: mm.key } }}
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1.5 text-note font-semibold capitalize transition-colors',
              mm.y === year && mm.mo === month ? 'bg-indigo-soft text-indigo' : 'text-label-3 hover:bg-bg',
            )}
          >
            {monthName(mm.y, mm.mo)}
          </Link>
        ))}
      </div>

      {statement && <OwnerMonthlyStatement statement={statement} />}
    </div>
  );
}
