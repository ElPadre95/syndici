'use client';

import { useState, useTransition } from 'react';
import { FileText, Eye, Lock, Pencil, Trash2, Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { CONTROL_CLASS } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { renameOwnDocumentAction, removeOwnDocumentAction } from '@/server/documents/owner-actions';

/** Une ligne « mes documents » (H6) : consulter, renommer, retirer — les siens uniquement. */
export function OwnerDocumentRow({
  id,
  name,
  scope,
  typeLabel,
  href,
}: {
  id: string;
  name: string;
  scope: 'PRIVE' | 'PARTAGE' | 'RESIDENCE' | 'INTERNE';
  typeLabel: string;
  href: string;
}) {
  const t = useTranslations('ownerDocs');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [confirming, setConfirming] = useState(false);

  const isPrivate = scope === 'PRIVE';

  function rename(): void {
    const fd = new FormData();
    fd.set('documentId', id);
    fd.set('name', draft);
    start(async () => {
      const res = await renameOwnDocumentAction(fd);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }
  function remove(): void {
    const fd = new FormData();
    fd.set('documentId', id);
    start(async () => {
      await removeOwnDocumentAction(fd);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border border-sep bg-card p-3">
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-md',
          isPrivate ? 'bg-bg text-label-3' : 'bg-indigo-soft text-indigo',
        )}
      >
        <FileText className="size-4" aria-hidden />
      </span>

      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={cn(CONTROL_CLASS, 'min-w-0 flex-1')}
          aria-label={t('name')}
        />
      ) : (
        <span className="min-w-0 flex-1">
          <a href={href} target="_blank" rel="noopener noreferrer" className="block truncate font-semibold text-label hover:text-indigo">
            {name}
          </a>
          <span className="flex items-center gap-1.5 text-note text-label-4">
            {isPrivate ? <Lock className="size-3" aria-hidden /> : <Eye className="size-3" aria-hidden />}
            {isPrivate ? t('badgePrivate') : t('badgeShared')} · {typeLabel}
          </span>
        </span>
      )}

      {editing ? (
        <span className="flex items-center gap-1">
          <Button type="button" size="sm" variant="secondary" loading={pending} onClick={rename} aria-label={t('save')}>
            <Check className="size-4" aria-hidden />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(name); }} aria-label={t('cancel')}>
            <X className="size-4" aria-hidden />
          </Button>
        </span>
      ) : confirming ? (
        <span className="flex items-center gap-1">
          <Button type="button" size="sm" variant="danger" loading={pending} onClick={remove}>
            {t('confirmRemove')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} aria-label={t('cancel')}>
            <X className="size-4" aria-hidden />
          </Button>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={t('rename')}>
            <Pencil className="size-4" aria-hidden />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-red" onClick={() => setConfirming(true)} aria-label={t('remove')}>
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </span>
      )}
    </li>
  );
}
