import { getLocale, getTranslations } from 'next-intl/server';
import { formatMoney } from '@/lib/money';
import { Card } from '@/components/ui/Card';
import type { CategoryBreakdown as Data } from '@/server/finance/expenses';

/**
 * Répartition des dépenses par catégorie (C2) — la lecture « budget » d'un coup d'œil :
 * chaque poste avec son montant et sa part du total, trié par montant décroissant.
 */
export async function CategoryBreakdown({ breakdown }: { breakdown: Data }) {
  const t = await getTranslations('expenses');
  const locale = await getLocale();
  const total = breakdown.totalMinor;

  return (
    <Card>
      <h2 className="mb-3 text-base font-bold text-label">{t('breakdown.title')}</h2>
      {breakdown.rows.length === 0 ? (
        <p className="text-sm text-label-3">{t('breakdown.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {breakdown.rows.map((r) => {
            const pct = total > 0 ? Math.round((r.totalMinor / total) * 100) : 0;
            return (
              <li key={r.categoryId ?? '__none__'} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-label">{r.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="tabular-nums text-label">
                      {formatMoney(r.totalMinor, locale)}
                    </span>
                    <span className="w-9 text-end text-xs tabular-nums text-label-4">{pct}%</span>
                  </span>
                </div>
                <span className="h-1.5 overflow-hidden rounded-full bg-bg">
                  <span
                    className="block h-full rounded-full bg-indigo"
                    style={{ inlineSize: `${Math.max(0, pct)}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
