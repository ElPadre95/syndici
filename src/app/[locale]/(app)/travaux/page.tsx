import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Hammer, Camera } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listWorksProjects } from '@/server/works/data';
import { CreateWorksForm } from '@/components/works/CreateWorksForm';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/money';

const STATUS_TONE = {
  CONSULTATION: 'neutral',
  EN_COURS: 'warning',
  TERMINE: 'success',
} as const;

/**
 * Travaux (I7) — syndic. Liste des chantiers (devis comparatifs + photos), et création.
 * Réservé au staff (`expense.manage`).
 */
export default async function TravauxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeC = await getLocale();
  const t = await getTranslations('travaux');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'expense.manage')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('forbidden')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const projects = await listWorksProjects(actx, true);
  const fmt = (m: number) => formatMoney(m, localeC);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="text-eyebrow font-bold uppercase text-indigo">{t('eyebrow')}</p>
        <h1 className="text-title text-label">{t('title')}</h1>
        <p className="text-note text-label-4">{t('subtitle')}</p>
      </header>

      <CreateWorksForm />

      {projects.length === 0 ? (
        <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">{t('empty')}</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sep text-note uppercase text-label-4">
                <th className="px-4 py-2.5 text-start font-bold">{t('col.project')}</th>
                <th className="px-4 py-2.5 text-start font-bold">{t('col.status')}</th>
                <th className="px-4 py-2.5 text-end font-bold">{t('col.quotes')}</th>
                <th className="px-4 py-2.5 text-end font-bold">{t('col.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sep">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-bg">
                  <td className="px-4 py-3">
                    <Link href={`/travaux/${p.id}`} className="font-semibold text-indigo hover:underline">
                      {p.title}
                    </Link>
                    <span className="ms-2 inline-flex items-center gap-2 align-middle">
                      {p.visibility === 'INTERNE' && (
                        <Badge tone="neutral">{t('visibilityInternal')}</Badge>
                      )}
                      {p.photoCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-note text-label-4">
                          <Camera className="size-3.5" aria-hidden />
                          {p.photoCount}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[p.status]}>{t(`status.${p.status}`)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-label-2">{p.quoteCount}</td>
                  <td className="px-4 py-3 text-end tabular-nums font-semibold text-label">
                    {p.selectedAmountMinor != null
                      ? fmt(p.selectedAmountMinor)
                      : p.cheapestAmountMinor != null
                        ? fmt(p.cheapestAmountMinor)
                        : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="flex items-center gap-2 text-note text-label-4" data-print-hide>
        <Hammer className="size-4" aria-hidden />
        {t('subtitle')}
      </p>
    </div>
  );
}
