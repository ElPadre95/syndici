'use client';

import { useRef, useTransition } from 'react';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { CONTROL_CLASS } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { addIncidentCommentAction } from '@/server/incidents/actions';

/** Ajout d'un commentaire au fil de suivi (déclarant ou staff). */
export function CommentComposer({ incidentId }: { incidentId: string }) {
  const t = useTranslations('incidents');
  const router = useRouter();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData): void {
    start(async () => {
      const res = await addIncidentCommentAction(fd);
      if (res.ok) {
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} action={submit} className="flex items-end gap-2">
      <input type="hidden" name="incidentId" value={incidentId} />
      <textarea
        name="message"
        required
        rows={2}
        placeholder={t('commentPlaceholder')}
        className={`${CONTROL_CLASS} resize-y`}
      />
      <Button type="submit" loading={pending} size="sm" aria-label={t('addComment')}>
        <Send className="size-4 rtl:-scale-x-100" aria-hidden />
      </Button>
    </form>
  );
}
