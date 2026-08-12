import { getLocale, getTranslations } from 'next-intl/server';
import { RevokeInvitationButton } from '@/components/invitations/RevokeInvitationButton';
import type { InvitationRow } from '@/server/invitations/data';
import { cn } from '@/lib/cn';

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-orange-soft text-orange',
  USED: 'bg-green-soft text-green',
  REVOKED: 'bg-bg text-label-3',
  EXPIRED: 'bg-red-soft text-red',
};

/** Suivi des invitations : personne, lot, état dérivé, date ; révocation si en attente. */
export async function InvitationList({
  invitations,
  back,
  showLot = false,
}: {
  invitations: InvitationRow[];
  back: string;
  showLot?: boolean;
}) {
  const t = await getTranslations('invitations.list');
  const tStatus = await getTranslations('invitations.status');
  const locale = await getLocale();
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  if (invitations.length === 0) {
    return <p className="text-sm italic text-label-4">{t('none')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
            <th className="py-2 pe-3 text-start font-bold">{t('colPerson')}</th>
            {showLot && <th className="py-2 pe-3 text-start font-bold">{t('colLot')}</th>}
            <th className="py-2 pe-3 text-start font-bold">{t('colStatus')}</th>
            <th className="py-2 pe-3 text-start font-bold">{t('colCreated')}</th>
            <th className="py-2 text-end font-bold" />
          </tr>
        </thead>
        <tbody>
          {invitations.map((inv) => (
            <tr key={inv.id} className="border-b border-sep last:border-b-0">
              <td className="py-2 pe-3">
                <span className="font-semibold text-label">{inv.personName ?? '—'}</span>
                <span className="ms-1 text-xs text-label-4">
                  · {inv.role === 'OWNER' ? t('roleOwner') : t('roleTenant')}
                </span>
              </td>
              {showLot && <td className="py-2 pe-3 text-label-3">{inv.lotReference}</td>}
              <td className="py-2 pe-3">
                <span
                  className={cn(
                    'inline-block rounded-full px-2 py-0.5 text-xs font-bold',
                    STATUS_TONE[inv.status],
                  )}
                >
                  {tStatus(inv.status)}
                </span>
              </td>
              <td className="py-2 pe-3 text-label-3">{fmt.format(new Date(inv.createdAt))}</td>
              <td className="py-2 text-end">
                {inv.status === 'PENDING' && (
                  <RevokeInvitationButton invitationId={inv.id} back={back} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
