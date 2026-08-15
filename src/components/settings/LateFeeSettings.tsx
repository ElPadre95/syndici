'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import {
  updateLateFeeConfigAction,
  generateLateFeesAction,
} from '@/server/finance/late-fee-actions';
import type { LateFeeSettings as Settings } from '@/server/settings/data';

const dh = (minor: number) => (minor / 100).toFixed(2);

/**
 * Réglage des frais de retard (H2) — syndic. Activation + montant fixe + pourcentage +
 * plafond. Un rappel juridique explicite (Maroc). Un bouton de génération idempotente.
 */
export function LateFeeSettings({ settings }: { settings: Settings }) {
  const t = useTranslations('lateFees');
  const router = useRouter();
  const [savePending, startSave] = useTransition();
  const [genPending, startGen] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save(fd: FormData): void {
    setMsg(null);
    startSave(async () => {
      const res = await updateLateFeeConfigAction(fd);
      setMsg(res.ok ? t('saved') : t('error'));
      if (res.ok) router.refresh();
    });
  }
  function generate(): void {
    setMsg(null);
    startGen(async () => {
      const res = await generateLateFeesAction();
      if (!res.ok) setMsg(t('error'));
      else if (res.disabled) setMsg(t('generateDisabled'));
      else setMsg(res.created > 0 ? t('generatedN', { n: res.created }) : t('generatedNone'));
      router.refresh();
    });
  }

  return (
    <form action={save} className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-md bg-orange-soft px-3 py-2 text-note text-orange">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        <span>{t('legal')}</span>
      </p>

      <label className="flex items-center gap-2 text-body font-semibold text-label-2">
        <input type="checkbox" name="autoLateFee" defaultChecked={settings.autoLateFee} className="size-4" />
        {t('enable')}
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field name="fixed" label={t('fixed')} type="text" inputMode="decimal" defaultValue={dh(settings.fixedMinor)} />
        <Field
          name="percent"
          label={t('percent')}
          type="text"
          inputMode="decimal"
          defaultValue={(settings.percentBps / 100).toString()}
        />
        <Field
          name="cap"
          label={t('cap')}
          type="text"
          inputMode="decimal"
          defaultValue={settings.capMinor != null ? dh(settings.capMinor) : ''}
        />
      </div>
      <p className="text-note text-label-4">{t('thresholdNote')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={savePending}>
          {savePending ? t('saving') : t('save')}
        </Button>
        <Button type="button" variant="subtle" loading={genPending} onClick={generate}>
          {genPending ? t('generating') : t('generate')}
        </Button>
        {msg && <span className="text-note font-semibold text-label-3">{msg}</span>}
      </div>
    </form>
  );
}
