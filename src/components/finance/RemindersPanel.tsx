'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, MessageCircle, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { recordReminderAction } from '@/server/finance/reminder-actions';
import { waLink } from '@/server/finance/reminders';

export interface ReminderRow {
  lotId: string;
  lotReference: string;
  recipientName: string | null;
  phoneDigits: string | null;
  amountLabel: string;
  retardDays: number;
  remindersSent: number;
  lastSentLabel: string | null;
  defaultMessage: string;
}

/**
 * Relances WhatsApp (E2). Aperçu ÉDITABLE, ouverture d'un lien wa.me pré-rempli, et trace
 * de l'INTENTION d'envoi (pas de certitude de réception). Relance unitaire ou groupée
 * (séquence lien par lien, chaque envoi marqué).
 */
export function RemindersPanel({ items }: { items: ReminderRow[] }) {
  const t = useTranslations('relances');
  const router = useRouter();
  const byId = useMemo(() => new Map(items.map((i) => [i.lotId, i])), [items]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [group, setGroup] = useState<{ queue: string[]; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const current = openId ? byId.get(openId) : undefined;
  const link = current ? waLink(current.phoneDigits, message) : '#';

  const openSingle = (it: ReminderRow) => {
    setGroup(null);
    setError(null);
    setMessage(it.defaultMessage);
    setOpenId(it.lotId);
  };
  const startGroup = () => {
    if (items.length === 0) return;
    const queue = items.map((i) => i.lotId);
    setGroup({ queue, index: 0 });
    setError(null);
    setMessage(items[0]!.defaultMessage);
    setOpenId(queue[0]!);
  };
  const close = () => {
    setOpenId(null);
    setGroup(null);
    router.refresh();
  };

  // Enregistre l'intention (le lien wa.me s'ouvre nativement via l'ancre), puis avance.
  const mark = (it: ReminderRow) => {
    const fd = new FormData();
    fd.set('lotId', it.lotId);
    fd.set('message', message);
    start(async () => {
      const res = await recordReminderAction(fd);
      if (!res.ok) {
        setError(t(`error.${res.error}`));
        return;
      }
      if (group && group.index + 1 < group.queue.length) {
        const nextIndex = group.index + 1;
        const next = byId.get(group.queue[nextIndex]!);
        setGroup({ ...group, index: nextIndex });
        if (next) setMessage(next.defaultMessage);
        setOpenId(group.queue[nextIndex]!);
      } else {
        close();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button variant="primary" onClick={startGroup} disabled={items.length === 0}>
          <Send className="size-4" aria-hidden />
          {t('remindAll')}
        </Button>
      </div>

      {error && !openId && (
        <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-sep bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
              <th className="px-4 py-2 text-start">{t('col.lot')}</th>
              <th className="px-4 py-2 text-start">{t('col.payer')}</th>
              <th className="px-4 py-2 text-end">{t('col.amount')}</th>
              <th className="px-4 py-2 text-end">{t('col.late')}</th>
              <th className="px-4 py-2 text-start">{t('col.history')}</th>
              <th className="px-4 py-2 text-end" />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.lotId} className="border-b border-sep last:border-0">
                <td className="px-4 py-3 font-semibold text-label">{it.lotReference}</td>
                <td className="px-4 py-3 text-label">{it.recipientName ?? '—'}</td>
                <td className="px-4 py-3 text-end font-bold tabular-nums text-label">
                  {it.amountLabel}
                </td>
                <td className="px-4 py-3 text-end">
                  <span className="rounded-full bg-red-soft px-2 py-0.5 text-xs font-bold text-red">
                    {t('lateDays', { days: it.retardDays })}
                  </span>
                </td>
                <td className="px-4 py-3 text-label-3">
                  {it.remindersSent === 0
                    ? t('history.never')
                    : t('history.sent', { count: it.remindersSent, date: it.lastSentLabel ?? '—' })}
                </td>
                <td className="px-4 py-3 text-end">
                  <Button variant="secondary" onClick={() => openSingle(it)}>
                    <MessageCircle className="size-4" aria-hidden />
                    {t('remind')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Aperçu éditable + ouverture WhatsApp */}
      {current && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-lg">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-label">
                  {group ? t('group.title') : t('preview.title', { lot: current.lotReference })}
                </h2>
                {group && (
                  <span className="text-xs font-semibold text-label-4">
                    {t('group.progress', { current: group.index + 1, total: group.queue.length })}
                  </span>
                )}
              </div>

              <p className="text-xs text-label-3">
                {current.phoneDigits
                  ? t('preview.phone', { phone: `+${current.phoneDigits}` })
                  : t('preview.noPhone')}
              </p>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-4">{t('preview.messageLabel')}</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={9}
                  className="whitespace-pre-wrap rounded-md border border-sep px-3 py-2 text-sm"
                />
              </label>

              <p className="rounded-md bg-bg px-3 py-2 text-xs text-label-3">
                {t('preview.intentNote')}
              </p>

              {error && (
                <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
                  <AlertCircle className="size-4 shrink-0" aria-hidden />
                  {error}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={close}>
                  {group ? t('group.finish') : t('preview.cancel')}
                </Button>
                {/* L'ancre ouvre WhatsApp nativement ; onClick trace l'intention + avance. */}
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => mark(current)}
                  aria-disabled={pending}
                  className="inline-flex items-center gap-2 rounded-md bg-green px-4 py-2 text-sm font-bold text-white hover:opacity-90"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  {group ? t('group.open') : t('preview.open')}
                </a>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
