'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { AlertCircle, FileText, Undo2, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { reverseExpenseAction } from '@/server/finance/expense-actions';
import type { ExpenseRow } from '@/server/finance/expenses';

export interface ExpenseRowView extends ExpenseRow {
  justificatifUrl: string | null;
}

/** Liste des dépenses (C1) : justificatif consultable, badge visibilité, annulation. */
export function ExpenseTable({ rows, canManage }: { rows: ExpenseRowView[]; canManage: boolean }) {
  const t = useTranslations('expenses');
  const locale = useLocale();
  const router = useRouter();
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fmtDate = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const submitReverse = (expenseId: string) => {
    if (!reason.trim()) {
      setError(t('error.reason_required'));
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set('expenseId', expenseId);
    fd.set('reason', reason.trim());
    start(async () => {
      const res = await reverseExpenseAction(fd);
      if (res.ok) {
        setReversingId(null);
        setReason('');
        router.refresh();
      } else setError(t(`error.${res.error}`));
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-sep bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
              <th className="px-4 py-2 text-start">{t('col.date')}</th>
              <th className="px-4 py-2 text-start">{t('col.category')}</th>
              <th className="px-4 py-2 text-start">{t('col.supplier')}</th>
              <th className="px-4 py-2 text-start">{t('col.justificatif')}</th>
              <th className="px-4 py-2 text-end">{t('col.amount')}</th>
              <th className="px-4 py-2 text-end" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-sep align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-label-3">
                  {fmtDate.format(new Date(r.spentOn))}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-label">{r.categoryLabel ?? '—'}</span>
                    <span className="text-xs text-label-4">{r.description}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-label-3">{r.supplierName ?? '—'}</span>
                    {r.visibility === 'INTERNE' && (
                      <span className="flex items-center gap-1 rounded-full bg-bg px-2 py-0.5 text-xs font-bold text-label-3">
                        <EyeOff className="size-3" aria-hidden />
                        {t('visibility.INTERNE')}
                      </span>
                    )}
                    {r.isReversal && (
                      <span className="rounded-full bg-orange-soft px-2 py-0.5 text-xs font-bold text-orange">
                        {t('reversal')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {r.justificatifUrl ? (
                    <a
                      href={r.justificatifUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-semibold text-indigo hover:underline"
                    >
                      <FileText className="size-3.5" aria-hidden />
                      {t('view')}
                    </a>
                  ) : (
                    <span className="text-label-4">—</span>
                  )}
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-end font-bold tabular-nums',
                    r.isReversal ? 'text-orange' : 'text-label',
                    r.reversed && 'text-label-4 line-through',
                  )}
                >
                  {formatMoney(r.amountMinor, locale)}
                </td>
                <td className="px-4 py-3 text-end">
                  {canManage && !r.isReversal && !r.reversed && (
                    <>
                      {reversingId === r.id ? (
                        <span className="flex items-center justify-end gap-2">
                          <input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={t('reasonHint')}
                            className="w-36 rounded-md border border-sep px-2 py-1 text-sm"
                          />
                          <Button
                            variant="secondary"
                            onClick={() => submitReverse(r.id)}
                            disabled={pending}
                          >
                            {t('confirmReverse')}
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
                        <Button variant="ghost" onClick={() => setReversingId(r.id)}>
                          <Undo2 className="size-4" aria-hidden />
                          {t('reverse')}
                        </Button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
