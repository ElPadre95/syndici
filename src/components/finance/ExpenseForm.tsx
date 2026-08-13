'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, Camera } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { recordExpenseAction } from '@/server/finance/expense-actions';
import type { ExpenseCategoryOption } from '@/server/finance/expenses';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Saisie rapide d'une dépense (C1). Le gérant photographie une facture (input capture) et
 * enregistre. Catégorie (données de la résidence), montant, date, fournisseur, description,
 * visibilité copropriétaires/interne, justificatif optionnel.
 */
export function ExpenseForm({ categories }: { categories: ExpenseCategoryOption[] }) {
  const t = useTranslations('expenses');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (form: HTMLFormElement) => {
    setError(null);
    const fd = new FormData(form);
    start(async () => {
      const res = await recordExpenseAction(fd);
      if (res.ok) router.push('/depenses');
      else setError(t(`error.${res.error}`));
    });
  };

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
        className="flex flex-col gap-4"
      >
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-label-3">{t('form.category')}</span>
            <select
              name="categoryId"
              defaultValue=""
              className="rounded-md border border-sep bg-white px-3 py-2 text-sm"
            >
              <option value="">{t('form.noCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-label-3">{t('form.amount')}</span>
            <input
              name="amount"
              inputMode="decimal"
              placeholder="0,00"
              className="rounded-md border border-sep px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-label-3">{t('form.date')}</span>
            <input
              name="spentOn"
              type="date"
              defaultValue={today()}
              className="rounded-md border border-sep px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-label-3">{t('form.supplier')}</span>
            <input
              name="supplierName"
              placeholder={t('form.supplierHint')}
              className="rounded-md border border-sep px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-label-3">{t('form.description')}</span>
          <input
            name="description"
            className="rounded-md border border-sep px-3 py-2 text-sm"
            placeholder={t('form.descriptionHint')}
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-label-3">{t('form.visibility')}</span>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="visibility" value="PARTAGE" defaultChecked />
              <span>{t('visibility.PARTAGE')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="visibility" value="INTERNE" />
              <span>{t('visibility.INTERNE')}</span>
            </label>
          </div>
          <p className="text-xs text-label-4">{t('form.visibilityHint')}</p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-label-3">{t('form.justificatif')}</span>
          <span className="flex items-center gap-3">
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sep bg-bg px-3 py-2 text-sm font-semibold text-label-3">
              <Camera className="size-4" aria-hidden />
              {t('form.chooseFile')}
              <input
                name="justificatif"
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </span>
            {fileName && <span className="truncate text-xs text-label-4">{fileName}</span>}
          </span>
          <span className="text-xs text-label-4">{t('form.justificatifHint')}</span>
        </label>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={pending}>
            {t('form.save')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/depenses')}>
            {t('form.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
