import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getSessionContext } from '@/server/session';
import { getIncidentDetail } from '@/server/incidents/data';
import { IncidentDetailView } from '@/components/incidents/IncidentDetailView';
import { CommentComposer } from '@/components/incidents/CommentComposer';

/**
 * Détail d'un signalement (H1) — propriétaire. Le mur (`getIncidentDetail` → `canAccessIncident`)
 * garantit qu'il n'accède qu'à ses lots + parties communes. Le déclarant suit le fil et peut
 * commenter ; il voit l'intervention et la facture si elles sont reliées.
 */
export default async function OwnerIncidentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('incidents');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE') {
    redirect(`/${locale}/proprietaire/incidents`);
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const detail = await getIncidentDetail(actx, id);
  if (!detail) redirect(`/${locale}/proprietaire/incidents`);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href="/proprietaire/incidents"
        className="inline-flex items-center gap-1.5 self-start text-note font-semibold text-label-3 hover:text-label"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t('ownerTitle')}
      </Link>
      <IncidentDetailView detail={detail} slot={<CommentComposer incidentId={detail.id} />} />
    </div>
  );
}
