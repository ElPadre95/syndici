import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listInvitations } from '@/server/invitations/data';
import { InvitationList } from '@/components/invitations/InvitationList';

export default async function InvitationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('invitations.list');
  const tLots = await getTranslations('lots.list');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'invitation.manage')) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
          {tLots('noActiveBody')}
        </p>
      </div>
    );
  }

  const invitations = await listInvitations({
    personId: ctx.personId,
    residenceId: ctx.activeId,
    role: ctx.role,
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
        <p className="mt-1 text-sm text-label-3">{t('subtitle')}</p>
      </div>
      <div className="rounded-lg border border-sep bg-white p-4">
        <InvitationList invitations={invitations} back="/invitations" showLot />
      </div>
    </div>
  );
}
