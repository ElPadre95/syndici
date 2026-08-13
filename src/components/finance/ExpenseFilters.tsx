'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import type { ExpenseCategoryOption } from '@/server/finance/expenses';

export interface ExpenseFilterState {
  category: string;
  from: string;
  to: string;
  supplier: string;
}

/**
 * Filtres de la liste des dépenses (C2) : catégorie et période (appliquées à la
 * navigation dès le changement), recherche fournisseur (à la validation). L'état vit
 * dans l'URL → partageable et rechargeable.
 */
export function ExpenseFilters({
  categories,
  current,
  isFiltered,
}: {
  categories: ExpenseCategoryOption[];
  current: ExpenseFilterState;
  isFiltered: boolean;
}) {
  const t = useTranslations('expenses');
  const router = useRouter();
  const [supplier, setSupplier] = useState(current.supplier);

  const push = (patch: Partial<ExpenseFilterState>) => {
    const next = { ...current, supplier, ...patch };
    const p = new URLSearchParams();
    if (next.category) p.set('category', next.category);
    if (next.from) p.set('from', next.from);
    if (next.to) p.set('to', next.to);
    if (next.supplier) p.set('supplier', next.supplier);
    const qs = p.toString();
    router.push(qs ? `/depenses?${qs}` : '/depenses');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        push({});
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-sep bg-white p-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-label-4">{t('filters.category')}</span>
        <select
          value={current.category}
          onChange={(e) => push({ category: e.target.value })}
          className="rounded-md border border-sep bg-white px-3 py-2 text-sm"
        >
          <option value="">{t('filters.allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-label-4">{t('filters.from')}</span>
        <input
          type="date"
          value={current.from}
          onChange={(e) => push({ from: e.target.value })}
          className="rounded-md border border-sep px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-label-4">{t('filters.to')}</span>
        <input
          type="date"
          value={current.to}
          onChange={(e) => push({ to: e.target.value })}
          className="rounded-md border border-sep px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-semibold text-label-4">{t('filters.supplier')}</span>
        <input
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder={t('filters.supplierHint')}
          className="min-w-40 rounded-md border border-sep px-3 py-2 text-sm"
        />
      </label>

      <Button type="submit" variant="secondary">
        <Search className="size-4" aria-hidden />
        {t('filters.search')}
      </Button>
      {isFiltered && (
        <Link
          href="/depenses"
          className="flex items-center gap-1 px-2 py-2 text-sm font-semibold text-label-3 hover:text-label"
        >
          <X className="size-4" aria-hidden />
          {t('filters.reset')}
        </Link>
      )}
    </form>
  );
}
