'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { publishAnnouncementAction } from '@/server/announcements/actions';
import { ANNOUNCEMENT_TYPES, ANNOUNCEMENT_AUDIENCES } from '@/server/announcements/data';

/** Publication d'une actualité (E3) : type, audience, titre, corps. Réservé au staff. */
export function AnnouncementForm() {
  const t = useTranslations('announcements');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (form: HTMLFormElement) => {
    setError(null);
    const fd = new FormData(form);
    start(async () => {
      const res = await publishAnnouncementAction(fd);
      if (res.ok) {
        form.reset();
        router.refresh();
      } else setError(t(`error.${res.error}`));
    });
  };

  return (
    <Card>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="text-base font-bold text-label">{t('form.title')}</h2>
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-label-3">{t('form.type')}</span>
            <select
              name="type"
              defaultValue="INFORMATION"
              className="rounded-md border border-sep bg-white px-3 py-2 text-sm"
            >
              {ANNOUNCEMENT_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`type.${ty}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-label-3">{t('form.audience')}</span>
            <select
              name="audience"
              defaultValue="ALL"
              className="rounded-md border border-sep bg-white px-3 py-2 text-sm"
            >
              {ANNOUNCEMENT_AUDIENCES.map((au) => (
                <option key={au} value={au}>
                  {t(`audience.${au}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-label-3">{t('form.subject')}</span>
          <input
            name="title"
            className="rounded-md border border-sep px-3 py-2 text-sm"
            placeholder={t('form.subjectHint')}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-label-3">{t('form.body')}</span>
          <textarea
            name="body"
            rows={4}
            className="rounded-md border border-sep px-3 py-2 text-sm"
            placeholder={t('form.bodyHint')}
          />
        </label>

        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            <Send className="size-4" aria-hidden />
            {t('form.publish')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
