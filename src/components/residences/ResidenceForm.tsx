'use client';

import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { createResidenceAction } from '@/server/residences/actions';
import type { CreateResidenceState, ResidenceType } from '@/server/residences/validation';

const FIELD_CLASS = 'rounded-md border border-sep px-3 py-2 font-normal';
const LABEL_CLASS = 'flex flex-col gap-1 text-sm font-semibold text-label';

/** Formulaire de création de résidence (A2). Erreurs par champ + erreur globale. */
export function ResidenceForm() {
  const t = useTranslations('residences.form');
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<CreateResidenceState, FormData>(
    createResidenceAction,
    {},
  );
  const [type, setType] = useState<ResidenceType>('IMMEUBLE');

  const needsAppt = type === 'IMMEUBLE' || type === 'MIXTE';
  const needsVilla = type === 'VILLA' || type === 'MIXTE';
  const err = (field: string) =>
    state.errors?.[field as keyof typeof state.errors] ? (
      <span className="text-sm text-red">
        {t(`errors.${state.errors[field as keyof typeof state.errors]}`)}
      </span>
    ) : null;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <label className={LABEL_CLASS}>
        {t('name')}
        <input name="name" type="text" required className={FIELD_CLASS} />
        {err('name')}
      </label>

      <label className={LABEL_CLASS}>
        {t('addressOptional')}
        <input name="address" type="text" className={FIELD_CLASS} />
      </label>

      <label className={LABEL_CLASS}>
        {t('city')}
        <input name="city" type="text" required className={FIELD_CLASS} />
        {err('city')}
      </label>

      <label className={LABEL_CLASS}>
        {t('type')}
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as ResidenceType)}
          className={FIELD_CLASS}
        >
          <option value="IMMEUBLE">{t('typeImmeuble')}</option>
          <option value="VILLA">{t('typeVilla')}</option>
          <option value="MIXTE">{t('typeMixte')}</option>
        </select>
        {err('type')}
      </label>

      <label className={LABEL_CLASS}>
        {t('unitsCount')}
        <input name="unitsCount" type="number" min={1} step={1} required className={FIELD_CLASS} />
        <span className="text-xs font-normal text-label-4">{t('unitsHint')}</span>
        {err('unitsCount')}
      </label>

      {needsAppt && (
        <label className={LABEL_CLASS}>
          {t('chargeAppt')}
          <input name="chargeAppt" type="text" inputMode="decimal" className={FIELD_CLASS} />
          {err('chargeAppt')}
        </label>
      )}

      {needsVilla && (
        <label className={LABEL_CLASS}>
          {t('chargeVilla')}
          <input name="chargeVilla" type="text" inputMode="decimal" className={FIELD_CLASS} />
          {err('chargeVilla')}
        </label>
      )}

      <label className={LABEL_CLASS}>
        {t('dueDay')}
        <input
          name="dueDay"
          type="number"
          min={1}
          max={28}
          step={1}
          defaultValue={1}
          required
          className={FIELD_CLASS}
        />
        <span className="text-xs font-normal text-label-4">{t('dueDayHint')}</span>
        {err('dueDay')}
      </label>

      {state.formError && (
        <p className="rounded-md bg-red-soft px-3 py-2 text-sm text-red">
          {t(`errors.${state.formError}`)}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {t('submit')}
        </Button>
        <Link href="/residences">
          <Button type="button" variant="ghost">
            {t('cancel')}
          </Button>
        </Link>
      </div>
    </form>
  );
}
