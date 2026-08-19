import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { prismaExecutor } from '@/server/db/sql';
import { listMembers } from '@/server/org/data';
import { isLastActiveAdmin } from '@/server/org/members';
import { MembersManager } from '@/components/settings/MembersManager';

/**
 * Membres du cabinet (F4). Liste, invitation par e-mail, rôle, retrait. Réservé à
 * l'administrateur (`member.manage` = SYNDIC) ; le dernier administrateur actif est protégé.
 */
export default async function MembresPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  const ctx = await getSessionContext();
  const active = ctx?.residences.find((r) => r.id === ctx.activeId) ?? null;
  if (!ctx?.activeId || !ctx.role || !active) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
          <Building2 className="size-6" aria-hidden />
        </span>
        <p className="text-base font-bold text-label">{t('noActiveTitle')}</p>
        <p className="max-w-sm text-sm text-label-3">{t('noActiveBody')}</p>
      </div>
    );
  }
  if (!can(ctx.role, 'member.manage')) {
    return (
      <p className="mx-auto max-w-3xl rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
        {t('forbidden')}
      </p>
    );
  }

  const scopedCtx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const org = await listMembers(prismaExecutor(), scopedCtx);
  const memberRows = org
    ? org.members.map((m) => ({
        membershipId: m.membershipId,
        fullName: `${m.firstName} ${m.lastName}`.trim(),
        email: m.email,
        role: m.role,
        status: m.status,
        hasAccount: m.hasAccount,
        endedAt: m.endedAt,
        isProtected: isLastActiveAdmin(org.members, m.membershipId),
        isSelf: m.personId === ctx.personId,
      }))
    : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-extrabold text-label">{t('members.title')}</h1>
      <MembersManager rows={memberRows} />
    </div>
  );
}
