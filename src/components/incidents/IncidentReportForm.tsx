'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { CONTROL_CLASS } from '@/components/ui/Field';
import { reportIncidentAction } from '@/server/incidents/actions';

/**
 * Formulaire de signalement (H1) — propriétaire. Catégorie, description, localisation, lot
 * (un des siens ou « partie commune »), urgence, photo optionnelle. Envoi via l'action
 * gardée ; on rafraîchit la liste. Aucune donnée de carte/PII saisie.
 */
export function IncidentReportForm({ lots }: { lots: Array<{ lotId: string; reference: string }> }) {
  const t = useTranslations('incidents');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData): void {
    setError(false);
    start(async () => {
      const res = await reportIncidentAction(fd);
      if (res.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(true);
      }
    });
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-col gap-4 rounded-lg border border-sep bg-card p-5">
      <p className="text-section font-bold text-label">{t('reportTitle')}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field name="category" label={t('category')} placeholder={t('categoryPlaceholder')} required />
        <Field name="location" label={t('location')} placeholder={t('locationPlaceholder')} required />
        <Select name="lotId" label={t('lot')} defaultValue="">
          <option value="">{t('commonArea')}</option>
          {lots.map((l) => (
            <option key={l.lotId} value={l.lotId}>
              {l.reference}
            </option>
          ))}
        </Select>
        <Select name="urgency" label={t('urgency')} defaultValue="NORMALE">
          <option value="NORMALE">{t('urgencyNORMALE')}</option>
          <option value="IMPORTANTE">{t('urgencyIMPORTANTE')}</option>
          <option value="URGENTE">{t('urgencyURGENTE')}</option>
        </Select>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-note font-semibold text-label-2">{t('description')}</span>
        <textarea
          name="description"
          required
          rows={3}
          placeholder={t('descriptionPlaceholder')}
          className={`${CONTROL_CLASS} resize-y`}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-note font-semibold text-label-2">{t('photo')}</span>
        <input type="file" name="photo" accept="image/*" className="text-note text-label-3" />
      </label>
      {error && (
        <p className="rounded-md bg-red-soft px-3 py-2 text-note font-semibold text-red">{t('error')}</p>
      )}
      <Button type="submit" loading={pending} className="self-start">
        {pending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
