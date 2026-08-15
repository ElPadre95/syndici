import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listStaffIncidents } from '@/server/incidents/data';
import { IncidentList } from '@/components/incidents/IncidentList';

/**
 * Incidents de la résidence (H1) — syndic. Liste triée du plus urgent au plus ancien.
 * Réservé au staff (`incident.manage`) : un résident n'atteint pas cet écran.
 */
export default async function StaffIncidentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('incidents');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !can(ctx.role ?? 'LOCATAIRE', 'incident.manage')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('emptyStaff')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role! };
  const rows = await listStaffIncidents(actx);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="text-eyebrow font-bold uppercase text-indigo">{t('eyebrow')}</p>
        <h1 className="text-title text-label">{t('title')}</h1>
        <p className="mt-1 text-body text-label-3">{t('staffSubtitle')}</p>
      </header>
      <IncidentList rows={rows} baseHref="/incidents" emptyKey="emptyStaff" />
    </div>
  );
}
