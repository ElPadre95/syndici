'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import {
  changeIncidentStatusAction,
  assignSupplierAction,
  linkExpenseToIncidentAction,
} from '@/server/incidents/actions';

type Status = 'NOUVEAU' | 'EN_COURS' | 'RESOLU';
const STATUSES: Status[] = ['NOUVEAU', 'EN_COURS', 'RESOLU'];

/** Panneau de gestion staff : statut, affectation fournisseur, lien vers une dépense. */
export function StaffIncidentActions({
  incidentId,
  status,
  linkableExpenses,
}: {
  incidentId: string;
  status: Status;
  linkableExpenses: Array<{ id: string; label: string }>;
}) {
  const t = useTranslations('incidents');
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: (fd: FormData) => Promise<unknown>) => (fd: FormData) =>
    start(async () => {
      await fn(fd);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-sep bg-card p-5">
      <p className="text-section font-bold text-label">{t('manage')}</p>

      {/* Statut */}
      <form action={run(changeIncidentStatusAction)} className="flex items-end gap-2">
        <input type="hidden" name="incidentId" value={incidentId} />
        <Select name="status" label={t('changeStatus')} defaultValue={status} className="min-w-40">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status${s}`)}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="subtle" size="sm" loading={pending}>
          {t('changeStatus')}
        </Button>
      </form>

      {/* Affectation fournisseur */}
      <form action={run(assignSupplierAction)} className="flex items-end gap-2">
        <input type="hidden" name="incidentId" value={incidentId} />
        <Field name="supplier" label={t('assignSupplier')} placeholder={t('supplierPlaceholder')} required className="min-w-52" />
        <Button type="submit" variant="subtle" size="sm" loading={pending}>
          {t('assign')}
        </Button>
      </form>

      {/* Lien vers une dépense (boucle de transparence) */}
      {linkableExpenses.length > 0 ? (
        <form action={run(linkExpenseToIncidentAction)} className="flex items-end gap-2">
          <input type="hidden" name="incidentId" value={incidentId} />
          <Select name="expenseId" label={t('linkExpense')} defaultValue="" className="min-w-52" required>
            <option value="" disabled>
              {t('chooseExpense')}
            </option>
            {linkableExpenses.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="subtle" size="sm" loading={pending}>
            {t('link')}
          </Button>
        </form>
      ) : (
        <p className="text-note text-label-4">{t('noExpenseToLink')}</p>
      )}
    </div>
  );
}
