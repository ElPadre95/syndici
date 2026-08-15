import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listOwnerIncidents } from '@/server/incidents/data';
import { listOwnerLots } from '@/server/finance/owner';
import { IncidentReportForm } from '@/components/incidents/IncidentReportForm';
import { IncidentList } from '@/components/incidents/IncidentList';

/**
 * Mes signalements (H1) — propriétaire. Signaler un incident (sur un de ses lots ou une
 * partie commune) et suivre l'avancement. Réservé au rôle PROPRIETAIRE ; la liste ne montre
 * que ses lots + les parties communes (mur `listOwnerIncidents`). Le locataire n'atteint
 * pas cet écran (variante de nav), et pourra le faire plus tard par différenciation de droits.
 */
export default async function OwnerIncidentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('incidents');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'incident.report')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('emptyStaff')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const [rows, lots] = await Promise.all([listOwnerIncidents(actx), listOwnerLots(actx)]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="text-eyebrow font-bold uppercase text-indigo">{t('eyebrow')}</p>
        <h1 className="text-title text-label">{t('ownerTitle')}</h1>
        <p className="mt-1 text-body text-label-3">{t('ownerSubtitle')}</p>
      </header>

      <IncidentReportForm lots={lots.map((l) => ({ lotId: l.lotId, reference: l.reference }))} />

      <section className="flex flex-col gap-3">
        <IncidentList rows={rows} baseHref="/proprietaire/incidents" emptyKey="empty" />
      </section>
    </div>
  );
}
