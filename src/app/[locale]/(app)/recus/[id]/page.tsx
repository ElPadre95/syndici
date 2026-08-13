import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { PrintButton } from '@/components/finance/PrintButton';
import { ReceiptDocument } from '@/components/finance/ReceiptDocument';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getReceipt } from '@/server/finance/receipts';

/**
 * Page reçu (B3). Réservée au staff (`receipt.issue`). Rend le document imprimable ;
 * la réimpression produit toujours le même reçu (numéro et montant figés en base).
 */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('receipts');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'receipt.issue')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">{t('forbidden')}</p>
      </div>
    );
  }

  const receipt = await getReceipt(
    { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role },
    id,
  );
  if (!receipt) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-bg px-3 py-2 text-sm text-label-3">{t('notFound')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3" data-print-hide>
        <Link href={receipt.lotReference ? `/lots` : `/paiements`}>
          <Button variant="ghost">
            <ArrowLeft className="size-4" aria-hidden />
            {t('back')}
          </Button>
        </Link>
        <PrintButton label={t('print')} />
      </div>
      <ReceiptDocument receipt={receipt} />
    </div>
  );
}
