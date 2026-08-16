'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Save } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { updateReminderRuleAction } from '@/server/settings/actions';
import type { ReminderRuleSettings } from '@/server/settings/data';

const CONCERNABLE = ['PARTIAL', 'UNSETTLED'] as const;

/** Réglage des seuils de relance (F1) : retard, délai anti-harcèlement, statuts concernés. */
export function ReminderRuleForm({ current }: { current: ReminderRuleSettings }) {
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
      const res = await updateReminderRuleAction(fd);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setErrors(res.errors ?? {});
    });
  };
  const err = (f: string) => (errors[f] ? t(`reminder.err.${errors[f]}`) : null);

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <h2 className="text-base font-bold text-label">{t('reminder.title')}</h2>
          <p className="mt-1 text-xs text-label-3">{t('reminder.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-label-3">{t('reminder.overdue')}</span>
            <input
              name="overdueThresholdDays"
              type="number"
              min={0}
              defaultValue={current.overdueThresholdDays}
              className="w-full rounded-md border border-sep px-3 py-2 text-sm"
            />
            <span className="text-xs text-label-4">{t('reminder.overdueHint')}</span>
            {err('overdueThresholdDays') && (
              <span className="text-xs font-semibold text-orange">
                {err('overdueThresholdDays')}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-label-3">{t('reminder.cooldown')}</span>
            <input
              name="minDaysBetweenReminders"
              type="number"
              min={1}
              defaultValue={current.minDaysBetweenReminders}
              className="w-full rounded-md border border-sep px-3 py-2 text-sm"
            />
            <span className="text-xs text-label-4">{t('reminder.cooldownHint')}</span>
            {err('minDaysBetweenReminders') && (
              <span className="text-xs font-semibold text-orange">
                {err('minDaysBetweenReminders')}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-label-3">{t('reminder.formalNotice')}</span>
            <input
              name="formalNoticeThresholdDays"
              type="number"
              min={1}
              defaultValue={current.formalNoticeThresholdDays}
              className="w-full rounded-md border border-sep px-3 py-2 text-sm"
            />
            <span className="text-xs text-label-4">{t('reminder.formalNoticeHint')}</span>
            {err('formalNoticeThresholdDays') && (
              <span className="text-xs font-semibold text-orange">
                {err('formalNoticeThresholdDays')}
              </span>
            )}
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-label-3">{t('reminder.states')}</span>
          <div className="flex flex-wrap gap-4 text-sm">
            {CONCERNABLE.map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="concernedSettlementStates"
                  value={s}
                  defaultChecked={current.concernedSettlementStates.includes(s)}
                />
                <span>{t(`reminder.state.${s}`)}</span>
              </label>
            ))}
          </div>
          {err('concernedSettlementStates') && (
            <span className="text-xs font-semibold text-orange">
              {err('concernedSettlementStates')}
            </span>
          )}
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
