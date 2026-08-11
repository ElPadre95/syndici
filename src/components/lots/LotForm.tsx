'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { createLotAction, updateLotAction } from '@/server/lots/actions';
import type { LotFormState } from '@/server/lots/validation';

const FIELD = 'rounded-md border border-sep px-3 py-2 font-normal';
const LABEL = 'flex flex-col gap-1 text-sm font-semibold text-label';

export interface LotInitial {
  id: string;
  reference: string;
  type: 'APPARTEMENT' | 'VILLA';
  floor: string | null;
  surfaceM2: number | null;
  quotePart: number;
  monthlyChargeMinor: number;
}

export function LotForm({ initial }: { initial?: LotInitial }) {
  const t = useTranslations('lots.form');
  const tType = useTranslations('lots.type');
  const locale = useLocale();
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState<LotFormState, FormData>(
    isEdit ? updateLotAction : createLotAction,
    {},
  );

  const err = (field: string) =>
    state.errors?.[field as keyof typeof state.errors] ? (
      <span className="text-sm text-red">
        {t(`errors.${state.errors[field as keyof typeof state.errors]}`)}
      </span>
    ) : null;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {initial && <input type="hidden" name="lotId" value={initial.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          {t('reference')}
          <input
            name="reference"
            type="text"
            required
            defaultValue={initial?.reference}
            className={FIELD}
          />
          {err('reference')}
        </label>

        <label className={LABEL}>
          {t('type')}
          <select name="type" defaultValue={initial?.type ?? 'APPARTEMENT'} className={FIELD}>
            <option value="APPARTEMENT">{tType('APPARTEMENT')}</option>
            <option value="VILLA">{tType('VILLA')}</option>
          </select>
          {err('type')}
        </label>

        <label className={LABEL}>
          {t('floorOptional')}
          <input name="floor" type="text" defaultValue={initial?.floor ?? ''} className={FIELD} />
        </label>

        <label className={LABEL}>
          {t('surfaceOptional')}
          <input
            name="surfaceM2"
            type="number"
            min={0}
            step={1}
            defaultValue={initial?.surfaceM2 ?? ''}
            className={FIELD}
          />
          {err('surfaceM2')}
        </label>

        <label className={LABEL}>
          {t('quotePart')}
          <input
            name="quotePart"
            type="number"
            min={0}
            step={1}
            defaultValue={initial?.quotePart ?? 0}
            className={FIELD}
          />
          <span className="text-xs font-normal text-label-4">{t('quotePartHint')}</span>
          {err('quotePart')}
        </label>

        <label className={LABEL}>
          {t('charge')}
          <input
            name="charge"
            type="text"
            inputMode="decimal"
            defaultValue={initial ? String(initial.monthlyChargeMinor / 100) : ''}
            className={FIELD}
          />
          <span className="text-xs font-normal text-label-4">{t('chargeHint')}</span>
          {err('charge')}
        </label>
      </div>

      {state.formError && (
        <p className="rounded-md bg-red-soft px-3 py-2 text-sm text-red">
          {t(`errors.${state.formError}`)}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {isEdit ? t('submitEdit') : t('submit')}
        </Button>
        <Link href="/lots">
          <Button type="button" variant="ghost">
            {t('cancel')}
          </Button>
        </Link>
      </div>
    </form>
  );
}
