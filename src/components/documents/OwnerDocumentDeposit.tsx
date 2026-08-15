'use client';

import { useRef, useState, useTransition } from 'react';
import { Eye, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { uploadOwnDocumentAction } from '@/server/documents/owner-actions';

const TYPES = ['ATTESTATION', 'ASSURANCE', 'REGLEMENT', 'PV_AG', 'AUTRE'] as const;

/**
 * Dépôt d'un document par le propriétaire (H6). Le CHOIX DE LA PORTÉE est fait au moment du
 * dépôt, présenté clairement : « visible par mon syndic » (PARTAGE) ou « privé, visible de
 * moi seul » (PRIVE). C'est une promesse à l'utilisateur — on la rend explicite ici.
 */
export function OwnerDocumentDeposit() {
  const t = useTranslations('ownerDocs');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scope, setScope] = useState<'PARTAGE' | 'PRIVE'>('PARTAGE');
  const [error, setError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData): void {
    setError(false);
    fd.set('scope', scope);
    start(async () => {
      const res = await uploadOwnDocumentAction(fd);
      if (res.ok) {
        formRef.current?.reset();
        setScope('PARTAGE');
        router.refresh();
      } else {
        setError(true);
      }
    });
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-col gap-4 rounded-lg border border-sep bg-card p-5">
      <p className="text-section font-bold text-label">{t('depositTitle')}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field name="name" label={t('name')} placeholder={t('namePlaceholder')} required />
        <Select name="type" label={t('type')} defaultValue="ATTESTATION">
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`docType.${ty}`)}
            </option>
          ))}
        </Select>
      </div>

      {/* Choix de la portée — présenté clairement */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-note font-semibold text-label-2">{t('scopeLegend')}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              { value: 'PARTAGE', Icon: Eye, title: t('scopeShared'), sub: t('scopeSharedSub') },
              { value: 'PRIVE', Icon: Lock, title: t('scopePrivate'), sub: t('scopePrivateSub') },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setScope(opt.value)}
              aria-pressed={scope === opt.value}
              className={cn(
                'flex items-start gap-2 rounded-md border p-3 text-start transition-colors',
                scope === opt.value ? 'border-indigo bg-indigo-soft' : 'border-sep bg-card hover:bg-bg',
              )}
            >
              <opt.Icon className={cn('mt-0.5 size-4 shrink-0', scope === opt.value ? 'text-indigo' : 'text-label-4')} aria-hidden />
              <span>
                <span className={cn('block text-body font-bold', scope === opt.value ? 'text-indigo' : 'text-label')}>
                  {opt.title}
                </span>
                <span className="block text-note text-label-4">{opt.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-note font-semibold text-label-2">{t('file')}</span>
        <input type="file" name="file" required className="text-note text-label-3" />
      </label>

      {error && (
        <p className="rounded-md bg-red-soft px-3 py-2 text-note font-semibold text-red">{t('error')}</p>
      )}
      <Button type="submit" loading={pending} className="self-start">
        {pending ? t('depositing') : t('deposit')}
      </Button>
    </form>
  );
}
