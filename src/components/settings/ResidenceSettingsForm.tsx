'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Save } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { updateResidenceSettingsAction } from '@/server/settings/actions';
import type { ResidenceSettings } from '@/server/settings/data';

const TYPES = ['IMMEUBLE', 'VILLA', 'MIXTE'] as const;
const dh = (minor: number) => (minor / 100).toFixed(2).replace('.', ',');

/** Édition de la résidence (F1) : nom, adresse, ville, type, charges, échéance. */
export function ResidenceSettingsForm({ current }: { current: ResidenceSettings }) {
  const t = useTranslations('settings');
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const submit = (form: HTMLFormElement) => {
    setErrors({});
    setSaved(false);
    const fd = new FormData(form);
    start(async () => {
      const res = await updateResidenceSettingsAction(fd);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setErrors(res.errors ?? {});
    });
  };
  const err = (f: string) => (errors[f] ? t(`residence.err.${errors[f]}`) : null);

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="text-base font-bold text-label">{t('residence.title')}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('residence.name')} error={err('name')}>
            <input
              name="name"
              defaultValue={current.name}
              className="w-full rounded-md border border-sep px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('residence.type')} error={err('type')}>
            <select
              name="type"
              defaultValue={current.type}
              className="w-full rounded-md border border-sep bg-white px-3 py-2 text-sm"
            >
              {TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`residence.typeOpt.${ty}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('residence.address')} error={null}>
            <input
              name="address"
              defaultValue={current.address ?? ''}
              className="w-full rounded-md border border-sep px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('residence.city')} error={err('city')}>
            <input
              name="city"
              defaultValue={current.city ?? ''}
              className="w-full rounded-md border border-sep px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('residence.chargeAppt')} error={err('chargeAppt')}>
            <input
              name="chargeAppt"
              defaultValue={dh(current.defaultChargeApptMinor)}
              inputMode="decimal"
              className="w-full rounded-md border border-sep px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('residence.chargeVilla')} error={err('chargeVilla')}>
            <input
              name="chargeVilla"
              defaultValue={dh(current.defaultChargeVillaMinor)}
              inputMode="decimal"
              className="w-full rounded-md border border-sep px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('residence.dueDay')} error={err('dueDay')}>
            <input
              name="dueDay"
              type="number"
              min={1}
              max={28}
              defaultValue={current.dueDayOfMonth}
              className="w-full rounded-md border border-sep px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending}>
            <Save className="size-4" aria-hidden />
            {t('save')}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm font-semibold text-green">
              <Check className="size-4" aria-hidden />
              {t('saved')}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-label-3">{label}</span>
      {children}
      {error && <span className="text-xs font-semibold text-orange">{error}</span>}
    </label>
  );
}
