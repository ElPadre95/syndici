import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { prismaExecutor } from '@/server/db/sql';
import { listResidentDirectory } from '@/server/auth/person-access';
import { listInvitations } from '@/server/invitations/data';
import { waLink, waPhoneDigits } from '@/server/finance/reminders';
import { residentAccountStatus } from '@/server/residents/status';
import { ResidentsDirectory, type ResidentRow } from '@/components/residents/ResidentsDirectory';

/**
 * Annuaire des résidents (F2). « Qui est Untel et comment le joindre. » Toutes les
 * personnes rattachées à la résidence active, dédoublées (cas MRE : une ligne, ses lots),
 * avec rôle, pays de résidence, langue, téléphone et état de compte. Recherche + filtres
 * côté client. Actions rapides : WhatsApp pré-rempli et émission d'invitation. Tout passe
 * par la couche person-access. Staff uniquement (`resident.list`).
 */
export default async function ResidentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('residents');

  const ctx = await getSessionContext();
  const active = ctx?.residences.find((r) => r.id === ctx.activeId) ?? null;
  if (!ctx?.activeId || !ctx.role || !active) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
          <Building2 className="size-6" aria-hidden />
        </span>
        <p className="text-base font-bold text-label">{t('dir.noActiveTitle')}</p>
        <p className="max-w-sm text-sm text-label-3">{t('dir.noActiveBody')}</p>
      </div>
    );
  }
  if (!can(ctx.role, 'resident.list')) {
    return (
      <p className="mx-auto max-w-3xl rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
        {t('dir.forbidden')}
      </p>
    );
  }

  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const exec = prismaExecutor();
  const [directory, invitations] = await Promise.all([
    listResidentDirectory(exec, actx),
    listInvitations(actx),
  ]);
  const canInvite = can(ctx.role, 'invitation.manage');

  // Personnes ayant une invitation EN ATTENTE (pour l'état « invité »).
  const pending = new Set(invitations.filter((i) => i.status === 'PENDING').map((i) => i.personId));

  // Message de contact WhatsApp dans la LANGUE DU DESTINATAIRE (contenu = catalogues).
  const tFr = await getTranslations({ locale: 'fr', namespace: 'residents' });
  const tAr = await getTranslations({ locale: 'ar', namespace: 'residents' });

  const rows: ResidentRow[] = directory.map((p) => {
    const digits = waPhoneDigits(p.phone);
    const tt = p.preferredLocale === 'ar' ? tAr : tFr;
    const fullName = `${p.firstName} ${p.lastName}`.trim();
    const firstActiveLot = p.lots.find((l) => l.active) ?? null;
    const activeRoles = new Set(p.lots.filter((l) => l.active).map((l) => l.role));
    return {
      personId: p.id,
      fullName,
      phone: p.phone,
      phoneDigits: digits,
      country: p.nationality,
      preferredLocale: p.preferredLocale,
      lots: p.lots,
      roles: [...activeRoles],
      accountStatus: residentAccountStatus(p.hasAccount, pending.has(p.id)),
      waHref: digits ? waLink(digits, tt('dir.waMessage', { name: fullName })) : null,
      inviteLotId: canInvite ? (firstActiveLot?.lotId ?? null) : null,
    };
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-label">{t('dir.title')}</h1>
        <p className="mt-1 text-sm text-label-3">{t('dir.subtitle', { residence: active.name })}</p>
      </div>
      <ResidentsDirectory rows={rows} canInvite={canInvite} />
    </div>
  );
}
