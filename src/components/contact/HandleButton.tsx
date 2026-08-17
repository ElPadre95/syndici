'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, RotateCcw } from 'lucide-react';
import { setContactHandledAction } from '@/server/contact/staff-actions';

/**
 * Bascule « traitée / à rouvrir » d'une demande de contact (J1, écran staff). Optimiste via
 * `useTransition` ; le rendu réel vient de la revalidation serveur.
 */
export function HandleButton({ id, handled }: { id: string; handled: boolean }) {
  const t = useTranslations('demandes');
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void setContactHandledAction(id, !handled))}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      style={
        handled
          ? { borderColor: 'var(--sep, #e2e7ee)', color: '#47566b' }
          : { borderColor: '#1240e0', color: '#1240e0' }
      }
    >
      {handled ? (
        <>
          <RotateCcw className="size-3.5" aria-hidden />
          {t('markPending')}
        </>
      ) : (
        <>
          <Check className="size-3.5" aria-hidden />
          {t('markHandled')}
        </>
      )}
    </button>
  );
}
