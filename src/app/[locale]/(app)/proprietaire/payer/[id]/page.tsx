import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { forResidence } from '@/server/db/tenant';
import { getOwnerLotCharges, getOwnerReceiptIdForCharge } from '@/server/finance/owner';
import { isOnlinePaymentEnabled } from '@/server/payments/provider';
import { PaymentTunnel } from '@/components/payments/PaymentTunnel';

/**
 * Tunnel de paiement en ligne SIMULÉ (G4). Réservé au PROPRIÉTAIRE du lot de l'appel, et
 * uniquement si la résidence a activé le paiement en ligne (désactivé par défaut). Mêmes
 * gardes que l'action : rôle + droit → résidence activée → détention du lot
 * (`getOwnerLotCharges` re-vérifie). En cas d'échec d'une garde, on renvoie vers les
 * charges. Si l'appel est DÉJÀ réglé (reste dû = 0), on affiche une confirmation avec le
 * lien vers le reçu — JAMAIS une redirection : sinon le re-rendu déclenché par le paiement
 * (l'action revalide la vue) ferait « rebondir » l'écran de succès.
 */
export default async function OwnerPaymentTunnelPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pay');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'payment.pay.own')) {
    redirect(`/${locale}/proprietaire/charges`);
  }
  const residenceId = ctx.activeId;
  const actx = { personId: ctx.personId, residenceId, role: ctx.role };

  if (!(await isOnlinePaymentEnabled(residenceId))) {
    redirect(`/${locale}/proprietaire/charges`);
  }

  const call = await forResidence(residenceId).chargeCall.findUnique({
    where: { id },
    select: { lotId: true, voidedAt: true },
  });
  if (!call || call.voidedAt) redirect(`/${locale}/proprietaire/charges`);

  const charges = await getOwnerLotCharges(actx, call.lotId);
  const charge = charges.find((c) => c.id === id);
  if (!charge) redirect(`/${locale}/proprietaire/charges`); // pas au propriétaire

  const lot = await forResidence(residenceId).lot.findUnique({
    where: { id: call.lotId },
    select: { reference: true },
  });

  // Déjà réglé (y compris juste après un paiement) : confirmation, jamais de rebond.
  if (charge.remainingMinor <= 0) {
    const receiptId = await getOwnerReceiptIdForCharge(actx, id);
    return (
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <div className="flex items-start gap-2 rounded-md bg-orange-soft px-3 py-2 text-note font-semibold text-orange">
          {t('simBanner')}
        </div>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-sep bg-card p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-green-soft text-green">
            <CheckCircle2 className="size-8" aria-hidden />
          </span>
          <h1 className="text-title text-label">{t('successTitle')}</h1>
          <p className="text-body text-label-3">{t('successBody')}</p>
          <div className="mt-2 flex flex-col gap-2 self-stretch">
            {receiptId && (
              <Link
                href={`/proprietaire/recus/${receiptId}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo px-4 py-2.5 text-body font-bold text-white transition-opacity hover:opacity-90"
              >
                {t('viewReceipt')}
                <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </Link>
            )}
            <Link
              href={`/proprietaire/charges?lot=${call.lotId}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-sep px-4 py-2.5 text-body font-semibold text-label-2 transition-colors hover:bg-bg"
            >
              {t('backCharges')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PaymentTunnel
      chargeCallId={charge.id}
      lotId={call.lotId}
      lotReference={lot?.reference ?? '—'}
      year={charge.year}
      month={charge.month}
      amountMinor={charge.remainingMinor}
    />
  );
}
