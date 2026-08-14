'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

/**
 * Bulle de messagerie (R1) — élément de chrome présent sur tous les écrans, en bas côté
 * fin (logique → passe à gauche en RTL). VISUEL seulement : la messagerie elle-même
 * arrivera avec l'espace propriétaire. Le compteur (`count`) s'affiche en pastille rouge
 * quand il y a des messages non lus ; aujourd'hui aucun flux n'est branché (count = 0).
 */
export function MessagingBubble({ count = 0 }: { count?: number }) {
  const tSoon = useTranslations('app.comingSoon');
  const tMsg = useTranslations('messagerie');
  const tBtn = useTranslations('buttons');
  const [open, setOpen] = useState(false);

  return (
    <div data-print-hide className="fixed bottom-6 end-6 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          role="dialog"
          aria-label={tMsg('msgConversations')}
          className="w-72 animate-popup-in rounded-lg border border-sep bg-card p-4 shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-section font-bold text-label">{tSoon('title')}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tBtn('btnClose')}
              className="rounded-md p-0.5 text-label-4 transition-colors hover:text-label"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-note text-label-3">{tSoon('body')}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={tMsg('msgConversations')}
        aria-expanded={open}
        className="relative flex size-14 items-center justify-center rounded-full bg-grad-indigo text-white shadow-indigo transition-transform hover:scale-105"
      >
        <MessageCircle className="size-6" aria-hidden />
        {count > 0 && (
          <span
            className={cn(
              'absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full',
              'bg-red px-1.5 text-eyebrow font-extrabold text-white ring-2 ring-bg',
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    </div>
  );
}
