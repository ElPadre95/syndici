import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Pencil, Plane, UserPlus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { EndAttachmentButton } from '@/components/lots/EndAttachmentButton';
import { InviteButton } from '@/components/invitations/InviteButton';
import { InvitationList } from '@/components/invitations/InvitationList';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getLot } from '@/server/lots/data';
import { listLotAttachments } from '@/server/lots/attachments';
import { listInvitations } from '@/server/invitations/data';
import { getLotFinance } from '@/server/finance/payments';
import { PaymentPanel } from '@/components/finance/PaymentPanel';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';

export default async function LotFichePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const activeLocale = await getLocale();
  const t = await getTranslations('lots.fiche');
  const tl = await getTranslations('lots.timeline');
  const tType = await getTranslations('lots.type');
  const tList = await getTranslations('lots.list');
  const tInv = await getTranslations('invitations.list');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'lot.view.all')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
          {tList('noActiveBody')}
        </p>
      </div>
    );
  }

  const lot = await getLot(ctx.activeId, id);
  if (!lot) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-bg px-3 py-2 text-sm text-label-3">{tList('emptyTitle')}</p>
      </div>
    );
  }
  const attachments = await listLotAttachments(
    { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role },
    id,
  );
  const canManage = can(ctx.role, 'lot.manage');
  const canInvite = can(ctx.role, 'invitation.manage');
  const invitations = await listInvitations(
    { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role },
    id,
  );
  const finance = await getLotFinance(
    { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role },
    id,
  );
  const canRecord = can(ctx.role, 'payment.record');
  const fmtDate = new Intl.DateTimeFormat(activeLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const identity: Array<[string, string]> = [
    [t('type'), tType(lot.type)],
    [t('floor'), lot.floor ?? '—'],
    [t('surface'), lot.surfaceM2 !== null ? `${lot.surfaceM2} m²` : '—'],
    [t('quotePart'), `${lot.quotePart} / 1000`],
    [t('charge'), formatMoney(lot.monthlyChargeMinor, activeLocale)],
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-label">Lot {lot.reference}</h1>
        <div className="flex gap-2">
          {canManage && (
            <Link href={`/lots/${lot.id}/personne/nouvelle`}>
              <Button variant="primary">
                <UserPlus className="size-4" aria-hidden />
                {tl('add')}
              </Button>
            </Link>
          )}
          <Link href={`/lots/${lot.id}/modifier`}>
            <Button variant="secondary">
              <Pencil className="size-4" aria-hidden />
              {t('edit')}
            </Button>
          </Link>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-sep bg-white p-4 sm:grid-cols-3">
        {identity.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-label-4">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-label">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-lg border border-sep bg-white p-4">
        <h2 className="mb-4 text-sm font-bold text-label">{tl('title')}</h2>
        {attachments.length === 0 ? (
          <p className="text-sm italic text-label-4">{tl('none')}</p>
        ) : (
          <ul className="flex flex-col">
            {attachments.map((a) => {
              const active = a.endDate === null;
              return (
                <li
                  key={a.id}
                  className={cn(
                    'flex flex-wrap items-start justify-between gap-3 border-s-2 py-3 ps-4',
                    active ? 'border-indigo' : 'border-sep opacity-70',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-label">{a.personName ?? '—'}</span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide',
                          a.role === 'OWNER' ? 'bg-indigo-soft text-indigo' : 'bg-bg text-label-3',
                        )}
                      >
                        {a.role === 'OWNER' ? tl('roleOwner') : tl('roleTenant')}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold',
                          active ? 'bg-green-soft text-green' : 'bg-bg text-label-3',
                        )}
                      >
                        {active ? tl('active') : tl('ended')}
                      </span>
                      {a.personAbroad && (
                        <span className="flex items-center gap-1 text-xs text-label-4">
                          <Plane className="size-3" aria-hidden />
                          {a.personCountry}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-label-3">
                      {active
                        ? tl('since', { date: fmtDate.format(new Date(a.startDate)) })
                        : tl('period', {
                            start: fmtDate.format(new Date(a.startDate)),
                            end: fmtDate.format(new Date(a.endDate as string)),
                          })}
                      {a.isChargePayer && (
                        <span className="text-label-4"> · {tl('chargePayer')}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {canInvite && (
                      <InviteButton lotId={lot.id} personId={a.personId} active={active} />
                    )}
                    {active && canManage && (
                      <EndAttachmentButton attachmentId={a.id} lotId={lot.id} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <PaymentPanel finance={finance} canRecord={canRecord} />

      <div className="rounded-lg border border-sep bg-white p-4">
        <h2 className="mb-4 text-sm font-bold text-label">{tInv('title')}</h2>
        <InvitationList invitations={invitations} back={`/lots/${lot.id}`} />
      </div>
    </div>
  );
}
