import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { PrintButton } from '@/components/finance/PrintButton';
import { AttestationDocument } from '@/components/finance/AttestationDocument';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getOwnerLotAccount } from '@/server/finance/owner';
import { formatMoney } from '@/lib/money';

/**
 * Attestation de non-dette (I4) — vue PROPRIÉTAIRE. Réservé au rôle PROPRIETAIRE
 * (`charge.view.own`) ET au lot détenu (`getOwnerLotAccount` renvoie null sinon). Le
 * propriétaire édite lui-même son attestation quand son compte est à jour.
 */
export default async function OwnerAttestationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const localeC = await getLocale();
  const t = await getTranslations('attestation');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'charge.view.own')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('notFound')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const account = await getOwnerLotAccount(actx, id);
  if (!account) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-bg px-3 py-2 text-body text-label-3">{t('notFound')}</p>
      </div>
    );
  }
  account.ownerName = ctx.userLabel;

  const back = (
    <Link href={`/proprietaire/lots/${id}/compte`} data-print-hide>
      <Button variant="ghost">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t('back')}
      </Button>
    </Link>
  );

  if (account.balanceMinor > 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {back}
        <p className="rounded-md bg-orange-soft px-3 py-4 text-center text-note font-semibold text-orange">
          {t('hasDebt', { amount: formatMoney(account.balanceMinor, localeC) })}
        </p>
      </div>
    );
  }

  const dateLabel = new Intl.DateTimeFormat(localeC, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const body = t('body', {
    residence: account.residence.name,
    lot: account.lotReference,
    owner: account.ownerName ?? '—',
    date: dateLabel,
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3" data-print-hide>
        {back}
        <PrintButton label={t('print')} />
      </div>
      <AttestationDocument
        residence={account.residence}
        lotReference={account.lotReference}
        ownerName={account.ownerName}
        dateLabel={dateLabel}
        title={t('docTitle')}
        body={body}
        refLabel={t('ref')}
        signatureLabel={t('signature')}
      />
    </div>
  );
}
