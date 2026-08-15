'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Select } from '@/components/ui/Select';
import { setOwnerSecondaryCurrencyAction } from '@/server/finance/currency-actions';

/**
 * Sélecteur de devise secondaire (H5) — propriétaire. Désactivée par défaut ; l'activer =
 * choisir une devise parmi les taux configurés. Édite SA propre préférence (person-access).
 */
export function CurrencySelector({
  current,
  available,
}: {
  current: string | null;
  available: string[];
}) {
  const t = useTranslations('currency');
  const router = useRouter();
  const [pending, start] = useTransition();

  function change(e: React.ChangeEvent<HTMLSelectElement>): void {
    const fd = new FormData();
    fd.set('currency', e.target.value);
    start(async () => {
      await setOwnerSecondaryCurrencyAction(fd);
      router.refresh();
    });
  }

  if (available.length === 0) {
    return <p className="text-note text-label-4">{t('noRates')}</p>;
  }

  return (
    <Select
      label={t('yourCurrency')}
      defaultValue={current ?? ''}
      onChange={change}
      disabled={pending}
      className="min-w-40"
    >
      <option value="">{t('none')}</option>
      {available.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </Select>
  );
}
