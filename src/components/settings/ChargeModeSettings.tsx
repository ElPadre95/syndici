'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { updateChargeModeAction } from '@/server/finance/charge-mode-actions';

const dh = (minor: number) => (minor / 100).toFixed(2);

/**
 * Mode de calcul des appels (I1) — syndic. FORFAIT (montant par lot) ou TANTIEMES (budget
 * mensuel réparti aux quotes-parts). Le budget mensuel n'est utilisé qu'en mode tantièmes.
 */
export function ChargeModeSettings({
  chargeMode,
  monthlyBudgetMinor,
}: {
  chargeMode: 'FORFAIT' | 'TANTIEMES';
  monthlyBudgetMinor: number;
}) {
  const t = useTranslations('chargeMode');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState(chargeMode);
  const [msg, setMsg] = useState<string | null>(null);

  function save(fd: FormData): void {
    setMsg(null);
    fd.set('chargeMode', mode);
    start(async () => {
      const res = await updateChargeModeAction(fd);
      setMsg(res.ok ? t('saved') : t('error'));
      if (res.ok) router.refresh();
    });
  }

  return (
    <form action={save} className="flex flex-col gap-4">
      <p className="text-note text-label-4">{t('hint')}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label={t('mode')} value={mode} onChange={(e) => setMode(e.target.value as 'FORFAIT' | 'TANTIEMES')}>
          <option value="FORFAIT">{t('forfait')}</option>
          <option value="TANTIEMES">{t('tantiemes')}</option>
        </Select>
        <Field
          name="monthlyBudget"
          label={t('monthlyBudget')}
          type="text"
          inputMode="decimal"
          defaultValue={dh(monthlyBudgetMinor)}
          hint={mode === 'TANTIEMES' ? t('budgetUsed') : t('budgetUnused')}
          disabled={mode !== 'TANTIEMES'}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? t('saving') : t('save')}
        </Button>
        {msg && <span className="text-note font-semibold text-label-3">{msg}</span>}
      </div>
    </form>
  );
}
