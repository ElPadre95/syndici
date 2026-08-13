'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Wallet, Undo2, AlertCircle, Receipt } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { recordPaymentAction, reversePaymentAction } from '@/server/finance/payment-actions';
import type { LotFinance, LotCall } from '@/server/finance/payments';

const METHODS = ['ESPECES', 'CHEQUE', 'VIREMENT'] as const;
const SETTLE_TONE: Record<string, string> = {
  SETTLED: 'bg-green-soft text-green',
  PARTIAL: 'bg-orange-soft text-orange',
  UNSETTLED: 'bg-bg text-label-3',
};

function centimesToInput(minor: number): string {
  return (minor / 100).toFixed(2).replace('.', ',');
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Charges & paiements d'un lot (B2). Encaisser un appel (espèces par défaut, chèque,
 * virement), voir l'historique, annuler par écriture inverse. Statuts DÉRIVÉS.
 */
export function PaymentPanel({ finance, canRecord }: { finance: LotFinance; canRecord: boolean }) {
  const t = useTranslations('payments');
  const locale = useLocale();
  const router = useRouter();
  const [openCall, setOpenCall] = useState<LotCall | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submitPayment = (form: HTMLFormElement) => {
    setError(null);
    const fd = new FormData(form);
    start(async () => {
      const res = await recordPaymentAction(fd);
      if (res.ok) {
        setOpenCall(null);
        router.refresh();
      } else setError(t(`error.${res.error}`));
    });
  };

  const submitReverse = (paymentId: string) => {
    if (!reason.trim()) {
      setError(t('error.reason_required'));
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set('paymentId', paymentId);
    fd.set('reason', reason.trim());
    start(async () => {
      const res = await reversePaymentAction(fd);
      if (res.ok) {
        setReversingId(null);
        setReason('');
        router.refresh();
      } else setError(t(`error.${res.error}`));
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-label">{t('title')}</h2>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {/* Appels de charges */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
                <th className="px-2 py-2 text-start">{t('call.period')}</th>
                <th className="px-2 py-2 text-end">{t('call.amount')}</th>
                <th className="px-2 py-2 text-end">{t('call.paid')}</th>
                <th className="px-2 py-2 text-end">{t('call.remaining')}</th>
                <th className="px-2 py-2 text-start">{t('call.status')}</th>
                <th className="px-2 py-2 text-end" />
              </tr>
            </thead>
            <tbody>
              {finance.calls.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-label-3">
                    {t('call.none')}
                  </td>
                </tr>
              )}
              {finance.calls.map((c) => {
                const period = new Intl.DateTimeFormat(locale, {
                  month: 'short',
                  year: 'numeric',
                }).format(new Date(c.year, c.month - 1, 1));
                return (
                  <tr key={c.id} className="border-b border-sep last:border-0">
                    <td className="px-2 py-2 font-semibold capitalize text-label">{period}</td>
                    <td className="px-2 py-2 text-end tabular-nums text-label">
                      {formatMoney(c.amountMinor, locale)}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums text-green">
                      {formatMoney(c.allocatedMinor, locale)}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums text-label">
                      {formatMoney(c.remainingMinor, locale)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-bold',
                          SETTLE_TONE[c.settlement],
                        )}
                      >
                        {t(`settlement.${c.settlement}`)}
                        {c.settlement !== 'SETTLED' && c.temporal === 'OVERDUE' && c.daysLate > 0
                          ? ` · ${t('late', { days: c.daysLate })}`
                          : ''}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-end">
                      {canRecord && c.settlement !== 'SETTLED' && (
                        <Button variant="secondary" onClick={() => setOpenCall(c)}>
                          <Wallet className="size-4" aria-hidden />
                          {t('record')}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Formulaire d'encaissement (pré-rempli : reste dû, espèces, aujourd'hui) */}
      {openCall && (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitPayment(e.currentTarget);
            }}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="chargeCallId" value={openCall.id} />
            <h3 className="text-base font-bold text-label">
              {t('form.title', {
                period: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
                  new Date(openCall.year, openCall.month - 1, 1),
                ),
              })}
            </h3>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('form.amount')}</span>
                <input
                  name="amount"
                  defaultValue={centimesToInput(openCall.remainingMinor)}
                  inputMode="decimal"
                  className="w-32 rounded-md border border-sep px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('form.method')}</span>
                <select
                  name="method"
                  defaultValue="ESPECES"
                  className="rounded-md border border-sep bg-white px-3 py-2 text-sm"
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(`method.${m}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('form.date')}</span>
                <input
                  name="receivedAt"
                  type="date"
                  defaultValue={today()}
                  className="rounded-md border border-sep px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('form.reference')}</span>
                <input
                  name="reference"
                  className="w-40 rounded-md border border-sep px-3 py-2 text-sm"
                  placeholder={t('form.referenceHint')}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={pending}>
                {t('form.confirm')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpenCall(null)}>
                {t('form.cancel')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Historique des paiements */}
      <Card>
        <h3 className="mb-3 text-base font-bold text-label">{t('history.title')}</h3>
        {finance.payments.length === 0 ? (
          <p className="text-sm text-label-3">{t('history.none')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-sep">
            {finance.payments.map((p) => {
              const date = new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(new Date(p.receivedAt));
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <span
                    className={cn(
                      'font-bold tabular-nums',
                      p.isReversal ? 'text-orange' : 'text-label',
                      p.reversed && 'text-label-4 line-through',
                    )}
                  >
                    {formatMoney(p.amountMinor, locale)}
                  </span>
                  <span className="text-label-3">{t(`method.${p.method}`)}</span>
                  <span className="text-label-4">·</span>
                  <span className="text-label-3">{date}</span>
                  {p.isReversal && (
                    <span className="rounded-full bg-orange-soft px-2 py-0.5 text-xs font-bold text-orange">
                      {t('history.reversal')}
                    </span>
                  )}
                  {p.reversed && (
                    <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-bold text-label-3">
                      {t('history.reversed')}
                    </span>
                  )}
                  {p.recordedByName && (
                    <span className="text-label-4">
                      {t('history.by', { name: p.recordedByName })}
                    </span>
                  )}
                  {p.note && <span className="italic text-label-4">« {p.note} »</span>}
                  {p.receiptNumber && p.receiptId && (
                    <Link
                      href={`/recus/${p.receiptId}`}
                      className={cn(
                        'flex items-center gap-1 font-mono text-xs font-semibold',
                        p.receiptVoided
                          ? 'text-label-4 line-through'
                          : 'text-indigo hover:underline',
                      )}
                    >
                      <Receipt className="size-3.5" aria-hidden />
                      {p.receiptNumber}
                    </Link>
                  )}
                  {canRecord && !p.isReversal && !p.reversed && (
                    <span className="ms-auto">
                      {reversingId === p.id ? (
                        <span className="flex items-center gap-2">
                          <input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={t('history.reasonHint')}
                            className="w-40 rounded-md border border-sep px-2 py-1 text-sm"
                          />
                          <Button
                            variant="secondary"
                            onClick={() => submitReverse(p.id)}
                            disabled={pending}
                          >
                            {t('history.confirmReverse')}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setReversingId(null);
                              setReason('');
                            }}
                          >
                            {t('form.cancel')}
                          </Button>
                        </span>
                      ) : (
                        <Button variant="ghost" onClick={() => setReversingId(p.id)}>
                          <Undo2 className="size-4" aria-hidden />
                          {t('history.reverse')}
                        </Button>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
