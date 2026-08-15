import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { PrintButton } from '@/components/finance/PrintButton';
import { ReceiptDocument } from '@/components/finance/ReceiptDocument';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getOwnerReceipt } from '@/server/finance/owner';

/**
 * Réimpression d'un reçu, vue PROPRIÉTAIRE. Réservé au rôle PROPRIETAIRE (`payment.view.own`)
 * ET à un reçu portant sur un lot qu'il détient (`getOwnerReceipt` vérifie la détention —
 * jamais le reçu d'un voisin). Le reçu est un instantané figé : la réimpression rend
 * toujours le même document. Composant réutilisé tel quel.
 */
export default async function OwnerReceiptPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('receipts');
  const tOwner = await getTranslations('owner');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'payment.view.own')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('notFound')}</p>
      </div>
    );
  }

  const receipt = await getOwnerReceipt(
    { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role },
    id,
  );
  if (!receipt) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-bg px-3 py-2 text-body text-label-3">{t('notFound')}</p>
      </div>
    );
  }

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
      <ReceiptDocument receipt={receipt} />
    </div>
  );
}
