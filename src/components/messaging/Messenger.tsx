'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Paperclip, Send, ArrowLeft, X, Loader2 } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/cn';
import { loadInboxAction, openThreadAction, sendMessageAction } from '@/server/messaging/actions';
import type { Inbox, ThreadView } from '@/server/messaging/data';

/**
 * Messagerie (G4) — composant unique, réutilisé côté propriétaire (dans la bulle) et
 * côté syndic (écran plein). `mode` fixe la perspective : « resident » ouvre un fil PAR
 * LOT (le sien) ; « staff » ouvre un fil existant par conversation. Le « côté » d'un
 * message (moi / l'autre) découle de `mode`. Aucun temps réel : on recharge après envoi.
 */
export function Messenger({
  mode,
  onUnreadChange,
  compact = false,
}: {
  mode: 'resident' | 'staff';
  onUnreadChange?: (n: number) => void;
  compact?: boolean;
}) {
  const t = useTranslations('messagerie');
  const locale = useLocale();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [thread, setThread] = useState<ThreadView | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  const totalUnread = (i: Inbox | null): number =>
    i && i.kind !== 'none' ? i.threads.reduce((s, r) => s + r.unread, 0) : 0;

  async function refreshInbox(): Promise<Inbox> {
    const next = await loadInboxAction();
    setInbox(next);
    onUnreadChange?.(totalUnread(next));
    return next;
  }

  useEffect(() => {
    void refreshInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages.length]);

  function openThread(key: { lotId?: string; conversationId?: string }): void {
    setThreadLoading(true);
    start(async () => {
      const view = await openThreadAction(key);
      setThread(view);
      setThreadLoading(false);
      await refreshInbox();
    });
  }

  function send(): void {
    if (!thread || (draft.trim() === '' && !file)) return;
    const fd = new FormData();
    fd.set('body', draft);
    if (mode === 'staff') fd.set('conversationId', thread.conversationId);
    else if (thread.lotId) fd.set('lotId', thread.lotId);
    if (file) fd.set('file', file);
    start(async () => {
      const res = await sendMessageAction(fd);
      if (res.ok) {
        setDraft('');
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
        const key =
          mode === 'staff'
            ? { conversationId: thread.conversationId }
            : { lotId: thread.lotId ?? undefined };
        const view = await openThreadAction(key);
        setThread(view);
        await refreshInbox();
      }
    });
  }

  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    );
  const roleLabel = (r: 'OWNER' | 'TENANT') => (r === 'OWNER' ? t('msgRoleOwner') : t('msgRoleTenant'));
  const mineSide = mode === 'staff' ? 'GERANT' : 'RESIDENT';

  // Boîte de réception normalisée : une forme commune quel que soit le rôle, avec la clé
  // d'ouverture (lotId pour un résident, conversationId pour le staff).
  interface Row {
    id: string;
    lotReference: string | null;
    counterpartyRole: 'OWNER' | 'TENANT';
    unread: number;
    lastBody: string | null;
    key: { lotId?: string; conversationId?: string };
  }
  const rows: Row[] =
    inbox === null || inbox.kind === 'none'
      ? []
      : inbox.kind === 'resident'
        ? inbox.threads.map((r) => ({
            id: r.lotId,
            lotReference: r.lotReference,
            counterpartyRole: r.counterpartyRole,
            unread: r.unread,
            lastBody: r.lastBody,
            key: { lotId: r.lotId },
          }))
        : inbox.threads.map((r) => ({
            id: r.conversationId,
            lotReference: r.lotReference,
            counterpartyRole: r.counterpartyRole,
            unread: r.unread,
            lastBody: r.lastBody,
            key: { conversationId: r.conversationId },
          }));

  // ── Vue liste (boîte de réception) ────────────────────────────────────────
  if (!thread) {
    return (
      <div className={cn('flex flex-col', compact ? 'max-h-[60vh]' : 'gap-2')}>
        {inbox === null ? (
          <p className="flex items-center gap-2 px-1 py-6 text-note text-label-4">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('msgLoading')}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-1 py-6 text-center text-note text-label-4">{t('msgAucune')}</p>
        ) : (
          <ul className={cn('flex flex-col', compact && 'overflow-y-auto')}>
            {rows.map((row) => (
                <li key={`${row.id}-${row.counterpartyRole}`}>
                  <button
                    type="button"
                    onClick={() => openThread(row.key)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-start transition-colors hover:bg-bg"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-soft text-note font-bold text-indigo">
                      {row.lotReference ?? '—'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-body font-semibold text-label">
                          {t('msgLot', { ref: row.lotReference ?? '—' })}
                        </span>
                        {mode === 'staff' && (
                          <span className="rounded-full bg-bg px-1.5 py-0.5 text-eyebrow font-bold uppercase text-label-3">
                            {roleLabel(row.counterpartyRole)}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-note text-label-4">
                        {row.lastBody ?? t('msgDemarrer')}
                      </span>
                    </span>
                    {row.unread > 0 && (
                      <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-red px-1.5 text-eyebrow font-extrabold text-white">
                        {row.unread}
                      </span>
                    )}
                  </button>
                </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ── Vue fil (messages + composeur) ────────────────────────────────────────
  return (
    <div className={cn('flex flex-col', compact ? 'h-[60vh]' : 'h-[70vh] rounded-lg border border-sep bg-card')}>
      <div className="flex items-center gap-2 border-b border-sep px-3 py-2.5">
        <button
          type="button"
          onClick={() => setThread(null)}
          aria-label={t('msgBack')}
          className="rounded-md p-1 text-label-3 transition-colors hover:bg-bg hover:text-label"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        </button>
        <div className="min-w-0">
          <p className="truncate text-body font-bold text-label">
            {t('msgLot', { ref: thread.lotReference ?? '—' })}
          </p>
          <p className="text-eyebrow font-semibold uppercase text-label-4">
            {mode === 'staff' ? roleLabel(thread.counterpartyRole) : t('msgThreadWithSyndic')}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {thread.messages.length === 0 ? (
          <p className="py-8 text-center text-note text-label-4">{t('msgDemarrer')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {thread.messages.map((m) => {
              const mine = m.side === mineSide;
              return (
                <li key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-3 py-2 text-body',
                      mine ? 'bg-indigo text-white' : 'bg-bg text-label',
                    )}
                  >
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.attachment && (
                      <a
                        href={m.attachment.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-note font-semibold',
                          mine ? 'bg-white/15 text-white' : 'bg-indigo-soft text-indigo',
                        )}
                      >
                        <Paperclip className="size-3.5" aria-hidden />
                        {m.attachment.name ?? t('msgAttachment')}
                      </a>
                    )}
                    <p className={cn('mt-1 text-eyebrow', mine ? 'text-white/60' : 'text-label-4')}>
                      {time(m.sentAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={listEndRef} />
      </div>

      <div className="border-t border-sep p-2">
        {file && (
          <div className="mb-1.5 flex items-center gap-1.5 rounded-md bg-indigo-soft px-2 py-1 text-note text-indigo">
            <Paperclip className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              aria-label={t('msgBack')}
              className="rounded p-0.5 hover:bg-indigo-mid"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={t('msgAttach')}
            className="shrink-0 rounded-md p-2 text-label-3 transition-colors hover:bg-bg hover:text-indigo"
          >
            <Paperclip className="size-5" aria-hidden />
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={t('msgPlaceholder')}
            className="max-h-28 min-h-9 flex-1 resize-none rounded-md border border-sep bg-card px-3 py-2 text-body text-label outline-none focus:border-indigo"
          />
          <button
            type="button"
            onClick={send}
            disabled={pending || (draft.trim() === '' && !file)}
            aria-label={t('msgSend')}
            className="shrink-0 rounded-md bg-indigo p-2 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Send className="size-5 rtl:-scale-x-100" aria-hidden />
            )}
          </button>
        </div>
      </div>
      {threadLoading && <span className="sr-only">{t('msgLoading')}</span>}
    </div>
  );
}
