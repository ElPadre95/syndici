'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, Plane } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import type { BoardRow } from '@/server/lots/board';

type FilterKey = 'all' | 'overdue' | 'rented' | 'vacant' | 'abroad';

function matchesFilter(row: BoardRow, key: FilterKey): boolean {
  switch (key) {
    case 'all':
      return true;
    case 'overdue':
      return row.temporal === 'OVERDUE' && row.settlement !== 'SETTLED';
    case 'rented':
      return row.occupancy === 'tenant';
    case 'vacant':
      return row.occupancy === 'vacant';
    case 'abroad':
      return row.ownerAbroad;
  }
}

const SETTLEMENT_TONE: Record<string, string> = {
  SETTLED: 'bg-green-soft text-green',
  PARTIAL: 'bg-orange-soft text-orange',
  UNSETTLED: 'bg-red-soft text-red',
};

export function BoardTable({ rows }: { rows: BoardRow[] }) {
  const t = useTranslations('lots');
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const fmtDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }),
    [locale],
  );

  const counts = useMemo(() => {
    const keys: FilterKey[] = ['all', 'overdue', 'rented', 'vacant', 'abroad'];
    return Object.fromEntries(
      keys.map((k) => [k, rows.filter((r) => matchesFilter(r, k)).length]),
    ) as Record<FilterKey, number>;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!matchesFilter(r, filter)) return false;
      if (!q) return true;
      const hay = [r.reference, r.owner?.name, r.tenant?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, filter]);

  function subnoteText(row: BoardRow): string | null {
    const s = row.subnote;
    if (!s) return null;
    if (s.kind === 'paidOn') return t('subnote.paidOn', { date: fmtDate.format(new Date(s.date)) });
    if (s.kind === 'received')
      return t('subnote.received', { amount: formatMoney(s.amountMinor, locale) });
    if (s.kind === 'dueOn') return t('subnote.dueOn', { date: fmtDate.format(new Date(s.date)) });
    return t('subnote.villa');
  }

  const filterKeys: FilterKey[] = ['all', 'overdue', 'rented', 'vacant', 'abroad'];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-label-4"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('board.searchPlaceholder')}
            className="w-full rounded-md border border-sep bg-white py-2 pe-3 ps-9 text-sm"
          />
        </div>
        {filterKeys.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              filter === k
                ? 'border-label bg-label text-white'
                : 'border-sep bg-white text-label-2 hover:bg-bg',
            )}
          >
            {t(`filters.${k}`)} · {counts[k]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-sep bg-white px-4 py-10 text-center text-sm text-label-3">
          {t('board.noResult')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sep bg-white">
          {visible.map((row) => (
            <Link
              key={row.id}
              href={`/lots/${row.id}`}
              className="grid min-w-[620px] grid-cols-[56px_1fr_170px_130px] items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0 hover:bg-indigo-soft"
            >
              <span className="rounded-md bg-bg py-1.5 text-center text-sm font-extrabold tracking-wide">
                {row.reference}
              </span>

              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-label">
                  {row.owner ? (
                    <>
                      <RoleBadge kind="owner" label={t('occupancy.roleOwner')} />
                      <span className="truncate">{row.owner.name}</span>
                      {row.owner.abroad && (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-label-4">
                          <Plane className="size-3" aria-hidden />
                          {row.owner.country}
                        </span>
                      )}
                    </>
                  ) : row.occupancy === 'vacant' ? (
                    <span className="italic text-label-4">{t('occupancy.vacant')}</span>
                  ) : (
                    <span className="text-label-3">{t('occupancy.ownerOccupied')}</span>
                  )}
                </span>
                {row.tenant ? (
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-label-3">
                    <RoleBadge kind="tenant" label={t('occupancy.roleTenant')} />
                    <span className="truncate">{row.tenant.name}</span>
                    {row.tenant.delegated && (
                      <span className="shrink-0 text-label-4">· {t('occupancy.delegated')}</span>
                    )}
                  </span>
                ) : row.owner && row.occupancy === 'owner' ? (
                  <span className="mt-0.5 block text-xs text-label-4">
                    {t('occupancy.ownerOccupied')}
                  </span>
                ) : null}
              </span>

              <span className="flex flex-wrap gap-1.5">
                {row.settlement && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-bold',
                      SETTLEMENT_TONE[row.settlement],
                    )}
                  >
                    {t(`state.settlement.${row.settlement}`)}
                  </span>
                )}
                {row.settlement !== 'SETTLED' && row.temporal && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-bold',
                      row.temporal === 'OVERDUE' ? 'bg-label text-white' : 'bg-bg text-label-3',
                    )}
                  >
                    {row.temporal === 'OVERDUE'
                      ? t('state.overdueDays', { days: row.daysLate })
                      : t(`state.temporal.${row.temporal}`)}
                  </span>
                )}
              </span>

              <span className="text-end">
                <span className="block text-sm font-bold tabular-nums text-label">
                  {formatMoney(row.amountMinor, locale)}
                </span>
                {subnoteText(row) && (
                  <span className="block text-xs text-label-3">{subnoteText(row)}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleBadge({ kind, label }: { kind: 'owner' | 'tenant'; label: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide',
        kind === 'owner' ? 'bg-indigo-soft text-indigo' : 'bg-bg text-label-3',
      )}
    >
      {label}
    </span>
  );
}
