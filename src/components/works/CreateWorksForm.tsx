'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createWorksProjectAction } from '@/server/works/actions';

/** Création d'un chantier (I7) — intitulé, description, visibilité. Redirige vers le détail. */
export function CreateWorksForm() {
  const t = useTranslations('travaux');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(fd: FormData): void {
    setError(null);
    start(async () => {
      const res = await createWorksProjectAction(fd);
      if (res.ok && res.id) router.push(`/travaux/${res.id}`);
      else if (!res.ok) setError(t(`error.${res.error}`));
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-body font-bold text-label">{t('newTitle')}</h2>
      <form action={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-label-3">{t('field.title')}</span>
          <input
            name="title"
            placeholder={t('field.titleHint')}
            className="rounded-md border border-sep px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-label-3">{t('field.description')}</span>
          <textarea name="description" rows={3} className="rounded-md border border-sep px-3 py-2 text-sm" />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-label-3">{t('field.visibility')}</span>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="visibility" value="PARTAGE" defaultChecked />
              <span>{t('visibilityShared')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="visibility" value="INTERNE" />
              <span>{t('visibilityInternal')}</span>
            </label>
          </div>
        </div>
        {error && <p className="text-note font-semibold text-orange">{error}</p>}
        <Button type="submit" loading={pending} className="self-start">
          <Plus className="size-4" aria-hidden />
          {t('create')}
        </Button>
      </form>
    </Card>
  );
}
