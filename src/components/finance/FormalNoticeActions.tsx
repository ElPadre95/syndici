'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Printer, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { recordFormalNoticeAction } from '@/server/finance/reminder-actions';

/**
 * Barre d'actions de la mise en demeure (I4, masquée à l'impression) : imprimer la lettre,
 * et tracer son émission (canal COURRIER). Le texte persisté est EXACTEMENT le corps affiché.
 */
export function FormalNoticeActions({
  lotId,
  letterText,
  alreadySent,
}: {
  lotId: string;
  letterText: string;
  alreadySent: boolean;
}) {
  const t = useTranslations('miseEnDemeure');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mark = () => {
    setError(null);
    const fd = new FormData();
    fd.set('lotId', lotId);
    fd.set('message', letterText);
    start(async () => {
      const res = await recordFormalNoticeAction(fd);
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else setError(t(`error.${res.error}`));
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3" data-print-hide>
      <Button variant="ghost" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden />
        {t('print')}
      </Button>
      <Button variant="primary" onClick={mark} loading={pending}>
        {t('markSent')}
      </Button>
      {(done || alreadySent) && (
        <span className="inline-flex items-center gap-1 text-note font-bold text-green">
          <Check className="size-4" aria-hidden />
          {t('sent')}
        </span>
      )}
      {error && (
        <span className="inline-flex items-center gap-1 text-note font-semibold text-orange">
          <AlertCircle className="size-4" aria-hidden />
          {error}
        </span>
      )}
    </div>
  );
}
