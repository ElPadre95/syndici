'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Archive, ArchiveRestore, Check, X, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import {
  addCategoryAction,
  renameCategoryAction,
  setCategoryArchivedAction,
} from '@/server/settings/actions';
import type { CategorySetting } from '@/server/settings/data';

/** Gestion des catégories de dépenses (F1) : ajouter, renommer, désactiver/réactiver. */
export function CategoriesManager({ categories }: { categories: CategorySetting[] }) {
  const t = useTranslations('settings');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [pending, start] = useTransition();

  const run = (
    fd: FormData,
    action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setError(null);
    start(async () => {
      const res = await action(fd);
      if (res.ok) {
        setNewLabel('');
        setEditingId(null);
        router.refresh();
      } else setError(t(`categories.err.${res.error}`));
    });
  };

  const add = () => {
    const fd = new FormData();
    fd.set('label', newLabel);
    run(fd, addCategoryAction);
  };
  const rename = (id: string) => {
    const fd = new FormData();
    fd.set('id', id);
    fd.set('label', editLabel);
    run(fd, renameCategoryAction);
  };
  const setArchived = (id: string, archived: boolean) => {
    const fd = new FormData();
    fd.set('id', id);
    fd.set('archived', String(archived));
    run(fd, setCategoryArchivedAction);
  };

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold text-label">{t('categories.title')}</h2>
          <p className="mt-1 text-xs text-label-3">{t('categories.subtitle')}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        {/* Ajouter */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex gap-2"
        >
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={t('categories.addHint')}
            className="flex-1 rounded-md border border-sep px-3 py-2 text-sm"
          />
          <Button type="submit" variant="secondary" disabled={pending || !newLabel.trim()}>
            <Plus className="size-4" aria-hidden />
            {t('categories.add')}
          </Button>
        </form>

        {/* Liste */}
        <ul className="flex flex-col divide-y divide-sep">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              {editingId === c.id ? (
                <>
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="flex-1 rounded-md border border-sep px-2 py-1 text-sm"
                  />
                  <Button variant="secondary" onClick={() => rename(c.id)} disabled={pending}>
                    <Check className="size-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="size-4" aria-hidden />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      'font-semibold',
                      c.archived ? 'text-label-4 line-through' : 'text-label',
                    )}
                  >
                    {c.label}
                  </span>
                  {c.archived && (
                    <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-bold text-label-4">
                      {t('categories.archived')}
                    </span>
                  )}
                  <span className="ms-auto flex gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditLabel(c.label);
                      }}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button variant="ghost" onClick={() => setArchived(c.id, !c.archived)}>
                      {c.archived ? (
                        <ArchiveRestore className="size-4" aria-hidden />
                      ) : (
                        <Archive className="size-4" aria-hidden />
                      )}
                    </Button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
