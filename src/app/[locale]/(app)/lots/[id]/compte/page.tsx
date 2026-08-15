import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { PrintButton } from '@/components/finance/PrintButton';
import { LotAccountDocument } from '@/components/finance/LotAccountDocument';
import { LateFeeReverseList } from '@/components/finance/LateFeeReverseList';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getLotAccount } from '@/server/finance/account';
import { listLotLateFees } from '@/server/finance/late-fees';
import { getTranslations as getT } from 'next-intl/server';

/**
 * Relevé de compte d'un lot (B4). Staff (`lot.view.all`). Imprimable ; les données
 * sont dérivées des appels et paiements immuables (rien n'est stocké).
 */
export default async function LotAccountPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('account');
  const tLate = await getT('lateFees');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'lot.view.all')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">{t('forbidden')}</p>
      </div>
    );
  }

  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const account = await getLotAccount(actx, id);
  if (!account) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-bg px-3 py-2 text-sm text-label-3">{t('notFound')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3" data-print-hide>
        <Link href={`/lots/${id}`}>
          <Button variant="ghost">
            <ArrowLeft className="size-4" aria-hidden />
            {t('back')}
          </Button>
        </Link>
        <PrintButton label={t('print')} />
      </div>
      <LotAccountDocument account={account} />
      {can(ctx.role, 'charge.manage') && (
        <section className="flex flex-col gap-2" data-print-hide>
          <h2 className="text-base font-bold text-label">{tLate('reverseTitle')}</h2>
          <LateFeeReverseList fees={await listLotLateFees(actx, id)} />
        </section>
      )}
    </div>
  );
}
