'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Ban } from 'lucide-react';
import { revokeInvitationAction } from '@/server/invitations/actions';

/** Révoque une invitation en attente. `back` = chemin (sans locale) de retour. */
export function RevokeInvitationButton({
  invitationId,
  back,
}: {
  invitationId: string;
  back: string;
}) {
  const t = useTranslations('invitations.list');
  const locale = useLocale();
  return (
    <form action={revokeInvitationAction}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-md border border-sep px-2 py-1 text-xs font-semibold text-red hover:bg-red-soft"
      >
        <Ban className="size-3" aria-hidden />
        {t('revoke')}
      </button>
    </form>
  );
}
