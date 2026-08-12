'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Send, Copy, Check, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { emitInvitationAction } from '@/server/invitations/actions';
import type { EmitResult } from '@/server/invitations/types';

/** Groupe le code en blocs de 4 pour la lisibilité (K7QM-R4XH-9TVB). */
function grouped(code: string): string {
  return (code.match(/.{1,4}/g) ?? [code]).join('-');
}

export function InviteButton({
  lotId,
  personId,
  active,
}: {
  lotId: string;
  personId: string;
  active: boolean;
}) {
  const t = useTranslations('invitations.invite');
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<EmitResult | null>(null);
  const [copied, setCopied] = useState(false);

  if (!active) {
    // Émission impossible sans rattachement actif : bouton indisponible + explication.
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <Button type="button" variant="ghost" disabled className="text-xs">
          <Send className="size-3.5" aria-hidden />
          {t('button')}
        </Button>
        <span className="text-[10px] text-label-4">{t('disabledHint')}</span>
      </span>
    );
  }

  function emit() {
    setCopied(false);
    start(async () => setResult(await emitInvitationAction(lotId, personId)));
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* clipboard indisponible : le code reste lisible à l'écran */
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={emit}
        disabled={pending}
        className="text-xs"
      >
        <Send className="size-3.5" aria-hidden />
        {t('button')}
      </Button>

      {result &&
        (result.ok ? (
          <div className="w-full max-w-md rounded-lg border border-sep bg-white p-4 text-start shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-label">{t('title')}</h3>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-label-4 hover:text-label"
                aria-label={t('close')}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="rounded-md bg-label px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.2em] text-white">
              {grouped(result.code)}
            </div>
            <p className="mt-1 text-xs text-label-4">
              {t('expiresOn', {
                date: new Intl.DateTimeFormat(locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(result.expiresAt)),
              })}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                onClick={() => copy(result.code)}
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
                {copied ? t('copied') : t('copy')}
              </Button>
              <a href={result.waHref} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="primary" className="text-xs">
                  <MessageCircle className="size-3.5" aria-hidden />
                  {t('waOpen')}
                </Button>
              </a>
            </div>
            <p className="mt-1 text-[10px] text-label-4">{t('waHint')}</p>

            <div className="mt-3 border-t border-sep pt-3">
              <p className="mb-1 text-xs font-semibold text-label-3">{t('preview')}</p>
              <p className="whitespace-pre-line rounded-md bg-bg p-3 text-xs leading-relaxed text-label-2">
                {result.message}
              </p>
            </div>

            <p className="mt-2 text-[10px] text-label-4">{t('noPii')}</p>
          </div>
        ) : (
          <p className="text-xs text-red">{t(`errors.${result.reason}`)}</p>
        ))}
    </div>
  );
}
