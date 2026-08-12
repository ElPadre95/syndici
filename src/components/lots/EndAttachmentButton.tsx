'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { endAttachmentAction } from '@/server/lots/attach-actions';

/** Termine un rattachement : saisie d'une date de fin, jamais de suppression. */
export function EndAttachmentButton({
  attachmentId,
  lotId,
}: {
  attachmentId: string;
  lotId: string;
}) {
  const t = useTranslations('lots.timeline');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (!open) {
    return (
      <Button type="button" variant="ghost" className="text-xs" onClick={() => setOpen(true)}>
        {t('end')}
      </Button>
    );
  }

  return (
    <form action={endAttachmentAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="attachmentId" value={attachmentId} />
      <input type="hidden" name="lotId" value={lotId} />
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-col gap-1 text-xs font-semibold text-label">
        {t('endDate')}
        <input
          name="endDate"
          type="date"
          required
          defaultValue={today}
          className="rounded-md border border-sep px-2 py-1 font-normal"
        />
      </label>
      <Button type="submit" variant="secondary" className="text-xs">
        {t('end')}
      </Button>
    </form>
  );
}
