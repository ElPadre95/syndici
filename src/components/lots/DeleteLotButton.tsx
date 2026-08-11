'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { deleteLotAction } from '@/server/lots/actions';

/**
 * Retrait d'un lot : archivage si historique, suppression si vierge (le serveur
 * décide et applique l'autorisation). Confirmation avant envoi.
 */
export function DeleteLotButton({ lotId, hasHistory }: { lotId: string; hasHistory: boolean }) {
  const t = useTranslations('lots.form');
  const locale = useLocale();
  const label = hasHistory ? t('archive') : t('deleteVierge');

  return (
    <form
      action={deleteLotAction}
      onSubmit={(e) => {
        if (!window.confirm(`${label} ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="lotId" value={lotId} />
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="ghost" className="text-red">
        <Trash2 className="size-4" aria-hidden />
        {label}
      </Button>
    </form>
  );
}
