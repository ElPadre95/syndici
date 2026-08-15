import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { PrintButton } from '@/components/finance/PrintButton';
import { LotAccountDocument } from '@/components/finance/LotAccountDocument';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getOwnerLotAccount } from '@/server/finance/owner';

/**
 * Relevé de compte d'un lot (B4), vue PROPRIÉTAIRE. Réservé au rôle PROPRIETAIRE
 * (`charge.view.own`) ET au lot qu'il détient (`getOwnerLotAccount` renvoie null sinon —
 * un propriétaire n'ouvre jamais le relevé d'un voisin). Imprimable ; le document est
 * réutilisé tel quel (sans logique de rôle).
 */
export default async function OwnerLotAccountPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('account');
  const tOwner = await getTranslations('owner');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'charge.view.own')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('notFound')}</p>
      </div>
    );
  }

  const account = await getOwnerLotAccount(
    { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role },
    id,
  );
  if (!account) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-bg px-3 py-2 text-body text-label-3">{t('notFound')}</p>
      </div>
    );
  }
  // Son propre nom (depuis la session), jamais résolu via la couche staff.
  account.ownerName = ctx.userLabel;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3" data-print-hide>
        <Link href="/proprietaire/charges">
          <Button variant="ghost">
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            {tOwner('backToCharges')}
          </Button>
        </Link>
        <PrintButton label={t('print')} />
      </div>
      <LotAccountDocument account={account} />
    </div>
  );
}
