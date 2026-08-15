'use client';

import { useState, useTransition } from 'react';
import { ShieldAlert, Home, CheckCircle2, ArrowRight, ArrowLeft, Loader2, CreditCard } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/money';
import { simulatePaymentAction, type SimulatePaymentResult } from '@/server/payments/actions';

/**
 * Tunnel de paiement SIMULÉ (G4). Un bandeau « simulation » PERMANENT à chaque étape.
 * AUCUN champ de carte, aucune collecte de donnée bancaire — on simule le parcours. À la
 * confirmation, l'action enregistre un paiement RÉEL (reçu numéroté) puis on affiche le
 * succès avec un lien vers le reçu.
 */
export function PaymentTunnel({
  chargeCallId,
  lotId,
  lotReference,
  year,
  month,
  amountMinor,
}: {
  chargeCallId: string;
  lotId: string;
  lotReference: string;
  year: number;
  month: number;
  amountMinor: number;
}) {
  const t = useTranslations('pay');
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SimulatePaymentResult | null>(null);

  const period = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );

  function pay(): void {
    const fd = new FormData();
    fd.set('chargeCallId', chargeCallId);
    // On NE rafraîchit PAS la page ici : le garde serveur du tunnel redirige vers les
    // charges dès que le reste dû tombe à 0. On garde l'écran de succès (state client) ;
    // la page « Mes charges » est déjà revalidée par l'action, donc fraîche à la navigation.
    start(async () => {
      setResult(await simulatePaymentAction(fd));
    });
  }

  const banner = (
    <div className="flex items-start gap-2 rounded-md bg-orange-soft px-3 py-2 text-note font-semibold text-orange">
      <ShieldAlert className="size-4 shrink-0" aria-hidden />
      <span>{t('simBanner')}</span>
    </div>
  );

  // ── Étape succès ──────────────────────────────────────────────────────────
  if (result?.ok) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-5">
        {banner}
        <div className="flex flex-col items-center gap-3 rounded-lg border border-sep bg-card p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-green-soft text-green">
            <CheckCircle2 className="size-8" aria-hidden />
          </span>
          <h1 className="text-title text-label">{t('successTitle')}</h1>
          <p className="text-body text-label-3">{t('successBody')}</p>
          <p className="text-stat font-extrabold tabular-nums text-label">
            {formatMoney(result.amountMinor, locale)}
          </p>
          <div className="mt-2 flex flex-col gap-2 self-stretch">
            {result.receiptId && (
              <Link
                href={`/proprietaire/recus/${result.receiptId}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo px-4 py-2.5 text-body font-bold text-white transition-opacity hover:opacity-90"
              >
                {t('viewReceipt')}
                <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </Link>
            )}
            <Link
              href={`/proprietaire/charges?lot=${lotId}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-sep px-4 py-2.5 text-body font-semibold text-label-2 transition-colors hover:bg-bg"
            >
              {t('backCharges')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Étape paiement ────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      {banner}

      <Link
        href={`/proprietaire/charges?lot=${lotId}`}
        className="inline-flex items-center gap-1.5 self-start text-note font-semibold text-label-3 hover:text-label"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t('backCharges')}
      </Link>

      <header>
        <p className="text-eyebrow font-bold uppercase text-indigo">{t('title')}</p>
        <h1 className="text-title text-label">{formatMoney(amountMinor, locale)}</h1>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border border-sep bg-card p-5">
        <p className="text-eyebrow font-bold uppercase text-label-4">{t('summary')}</p>
        <dl className="flex flex-col gap-2 text-body">
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-label-3">
              <Home className="size-4" aria-hidden />
              {t('period')}
            </dt>
            <dd className="font-semibold text-label">
              {lotReference} · {period}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-sep pt-2">
            <dt className="text-label-3">{t('amountDue')}</dt>
            <dd className="text-stat font-extrabold tabular-nums text-label">
              {formatMoney(amountMinor, locale)}
            </dd>
          </div>
        </dl>
      </div>

      {result && !result.ok && (
        <p className="rounded-md bg-red-soft px-3 py-2 text-note font-semibold text-red">
          {result.error === 'forbidden' || result.error === 'disabled'
            ? t('forbidden')
            : t('error')}
        </p>
      )}

      <button
        type="button"
        onClick={pay}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo px-4 py-3 text-body font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            {t('processing')}
          </>
        ) : (
          <>
            <CreditCard className="size-5" aria-hidden />
            {t('button')}
          </>
        )}
      </button>

      <p className="text-center text-note text-label-4">{t('noCard')}</p>
    </div>
  );
}
