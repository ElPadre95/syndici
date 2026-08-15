import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getIncidentDetail, listLinkableExpenses } from '@/server/incidents/data';
import { IncidentDetailView } from '@/components/incidents/IncidentDetailView';
import { StaffIncidentActions } from '@/components/incidents/StaffIncidentActions';
import { CommentComposer } from '@/components/incidents/CommentComposer';

/**
 * Détail d'un incident (H1) — syndic. Le fil de suivi, le changement de statut,
 * l'affectation à un fournisseur, et le lien vers la dépense (boucle de transparence).
 * Réservé au staff (`incident.manage`).
 */
export default async function StaffIncidentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('incidents');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !can(ctx.role ?? 'LOCATAIRE', 'incident.manage')) {
    redirect(`/${locale}/incidents`);
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role! };
  const [detail, linkable] = await Promise.all([
    getIncidentDetail(actx, id),
    listLinkableExpenses(actx),
  ]);
  if (!detail) redirect(`/${locale}/incidents`);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href="/incidents"
        className="inline-flex items-center gap-1.5 self-start text-note font-semibold text-label-3 hover:text-label"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t('title')}
      </Link>
      <IncidentDetailView
        detail={detail}
        slot={
          <div className="flex flex-col gap-4">
            <StaffIncidentActions incidentId={detail.id} status={detail.status} linkableExpenses={linkable} />
            <CommentComposer incidentId={detail.id} />
          </div>
        }
      />
    </div>
  );
}
