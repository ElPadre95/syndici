'use client';

import { useState } from 'react';
import { MessageCircle, X, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { Messenger } from '@/components/messaging/Messenger';
import type { NavVariant } from '@/components/app/AppSidebar';

/**
 * Bulle de messagerie (R1 → branchée en G4). Chrome présent sur tous les écrans, en bas
 * côté fin (logique → gauche en RTL). La pastille rouge porte le nombre de messages non
 * lus (fourni par le serveur, puis rafraîchi à l'ouverture du panneau).
 *
 * Propriétaire : le panneau EST la messagerie (liste des fils → fil → composeur).
 * Syndic : le panneau renvoie vers l'écran dédié (fils groupés par lot). Locataire : pas
 * encore d'espace — la bulle ne s'affiche pas (son fil existe déjà dans le modèle).
 */
export function MessagingBubble({
  variant,
  unread = 0,
}: {
  variant: NavVariant;
  unread?: number;
}) {
  const t = useTranslations('messagerie');
  const tBtn = useTranslations('buttons');
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unread);

  if (variant === 'tenant') return null;

  return (
    <div data-print-hide className="fixed bottom-6 end-6 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          role="dialog"
          aria-label={t('msgTitle')}
          className="flex w-80 max-w-[86vw] animate-popup-in flex-col overflow-hidden rounded-lg border border-sep bg-card shadow-md"
        >
          <div className="flex items-center justify-between gap-2 border-b border-sep px-4 py-3">
            <p className="text-section font-bold text-label">{t('msgTitle')}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tBtn('btnClose')}
              className="rounded-md p-0.5 text-label-4 transition-colors hover:text-label"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {variant === 'owner' ? (
            <div className="p-2">
              <Messenger mode="resident" compact onUnreadChange={setCount} />
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-4">
              <p className="text-note text-label-3">{t('msgSubGerant')}</p>
              <Link
                href="/messagerie"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 self-start rounded-md bg-indigo px-3 py-2 text-body font-bold text-white transition-opacity hover:opacity-90"
              >
                {t('msgOpen')}
                <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('msgTitle')}
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
