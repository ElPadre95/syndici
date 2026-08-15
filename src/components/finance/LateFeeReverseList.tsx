'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { formatMoney } from '@/lib/money';
import { Button } from '@/components/ui/Button';
import { CONTROL_CLASS } from '@/components/ui/Field';
import { reverseLateFeeAction } from '@/server/finance/late-fee-actions';
import type { LotLateFeeRow } from '@/server/finance/late-fees';

/**
 * Frais de retard d'un lot (H2) — vue staff. Chaque frais actif peut être annulé par
 * écriture inverse (motif requis, tracé). Les frais annulés / les écritures inverses sont
 * affichés mais non ré-annulables.
 */
export function LateFeeReverseList({ fees }: { fees: LotLateFeeRow[] }) {
  const t = useTranslations('lateFees');
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);

  if (fees.length === 0) {
    return <p className="rounded-md bg-bg px-3 py-4 text-center text-note text-label-4">{t('none')}</p>;
  }

  function reverse(fd: FormData): void {
    start(async () => {
      const res = await reverseLateFeeAction(fd);
      if (res.ok) {
        setOpenId(null);
        router.refresh();
      }
    });
  }

  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

  return (
    <ul className="flex flex-col gap-2" data-print-hide>
      {fees.map((f) => (
        <li key={f.id} className="rounded-md border border-sep bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tabular-nums text-label">{formatMoney(f.amountMinor, locale)}</span>
            <span className="text-note text-label-4">{day(f.appliedAt)}</span>
            {f.reversed && (
              <span className="rounded-full bg-bg px-2 py-0.5 text-eyebrow font-bold uppercase text-label-4">
                {t('reversed')}
              </span>
            )}
            {!f.isReversal && !f.reversed && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ms-auto text-red"
                onClick={() => setOpenId(openId === f.id ? null : f.id)}
              >
                {t('reverse')}
              </Button>
            )}
          </div>
          {openId === f.id && (
            <form action={reverse} className="mt-2 flex items-end gap-2">
              <input type="hidden" name="lateFeeId" value={f.id} />
              <input name="reason" required placeholder={t('reverseReason')} className={CONTROL_CLASS} />
              <Button type="submit" variant="danger" size="sm" loading={pending}>
                {t('reverseConfirm')}
              </Button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
