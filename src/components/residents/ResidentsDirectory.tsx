'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, MessageCircle, UserPlus, AlertCircle, Home } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { emitInvitationAction } from '@/server/invitations/actions';
import {
  matchesResidentFilters,
  type RoleFilter,
  type StatusFilter,
} from '@/server/residents/filter';

export interface ResidentRow {
  personId: string;
  fullName: string;
  phone: string | null;
  phoneDigits: string | null;
  country: string | null;
  preferredLocale: string;
  lots: { lotId: string; reference: string; role: 'OWNER' | 'TENANT'; active: boolean }[];
  roles: ('OWNER' | 'TENANT')[];
  accountStatus: 'ACTIVE' | 'PENDING' | 'NEVER';
  waHref: string | null;
  inviteLotId: string | null;
}

const STATUS_STYLE: Record<ResidentRow['accountStatus'], string> = {
  ACTIVE: 'bg-green-soft text-green',
  PENDING: 'bg-indigo-soft text-indigo',
  NEVER: 'bg-bg text-label-4',
};

/** Annuaire des résidents (F2) : recherche, filtres, contact WhatsApp, invitation. */
export function ResidentsDirectory({
  rows,
  canInvite,
}: {
  rows: ResidentRow[];
  canInvite: boolean;
}) {
  const t = useTranslations('residents');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(
    () => rows.filter((r) => matchesResidentFilters(r, { query, role, status })),
    [rows, query, role, status],
  );

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.accountStatus === 'ACTIVE').length,
      pending: rows.filter((r) => r.accountStatus === 'PENDING').length,
    }),
    [rows],
  );

  const langLabel = (code: string) => t(`dir.lang.${code}`);

  const invite = (r: ResidentRow) => {
    if (!r.inviteLotId) return;
    setError(null);
    setPendingId(r.personId);
    start(async () => {
      const res = await emitInvitationAction(r.inviteLotId!, r.personId);
      setPendingId(null);
      if (res.ok) {
        if (res.waHref) window.open(res.waHref, '_blank', 'noopener,noreferrer');
        router.refresh();
      } else {
        setError(t(`dir.err.${res.reason}`));
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('dir.stat.total')} value={stats.total} />
        <Stat label={t('dir.stat.active')} value={stats.active} />
        <Stat label={t('dir.stat.pending')} value={stats.pending} />
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-label-4"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('dir.searchHint')}
            className="w-full rounded-md border border-sep py-2 pe-3 ps-9 text-sm"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleFilter)}
          className="rounded-md border border-sep px-3 py-2 text-sm"
          aria-label={t('dir.filterRole')}
        >
          <option value="ALL">{t('dir.role.all')}</option>
          <option value="OWNER">{t('dir.role.OWNER')}</option>
          <option value="TENANT">{t('dir.role.TENANT')}</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded-md border border-sep px-3 py-2 text-sm"
          aria-label={t('dir.filterStatus')}
        >
          <option value="ALL">{t('dir.status.all')}</option>
          <option value="NEVER">{t('dir.status.NEVER')}</option>
          <option value="PENDING">{t('dir.status.PENDING')}</option>
          <option value="ACTIVE">{t('dir.status.ACTIVE')}</option>
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
          <p className="text-sm font-semibold text-label-3">{t('dir.empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sep bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
                <th className="px-4 py-2 text-start">{t('dir.col.name')}</th>
                <th className="px-4 py-2 text-start">{t('dir.col.lots')}</th>
                <th className="px-4 py-2 text-start">{t('dir.col.country')}</th>
                <th className="px-4 py-2 text-start">{t('dir.col.lang')}</th>
                <th className="px-4 py-2 text-start">{t('dir.col.phone')}</th>
                <th className="px-4 py-2 text-start">{t('dir.col.account')}</th>
                <th className="px-4 py-2 text-end" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.personId} className="border-b border-sep align-top last:border-0">
                  <td className="px-4 py-3 font-semibold text-label">{r.fullName}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.lots.map((l) => (
                        <Link
                          key={l.lotId}
                          href={`/lots/${l.lotId}`}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
                            l.active ? 'bg-indigo-soft text-indigo' : 'bg-bg text-label-4',
                            !l.active && 'line-through',
                          )}
                          title={t(`dir.role.${l.role}`)}
                        >
                          <Home className="size-3" aria-hidden />
                          {l.reference}
                          <span className="font-medium opacity-70">
                            · {t(`dir.roleShort.${l.role}`)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-label-3">{r.country ?? '—'}</td>
                  <td className="px-4 py-3 text-label-3">{langLabel(r.preferredLocale)}</td>
                  <td className="px-4 py-3 tabular-nums text-label-3">{r.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-bold',
                        STATUS_STYLE[r.accountStatus],
                      )}
                    >
                      {t(`dir.status.${r.accountStatus}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {r.waHref && (
                        <a
                          href={r.waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-green px-2.5 py-1.5 text-xs font-bold text-white hover:opacity-90"
                          title={t('dir.contact')}
                        >
                          <MessageCircle className="size-4" aria-hidden />
                        </a>
                      )}
                      {canInvite && r.accountStatus !== 'ACTIVE' && r.inviteLotId && (
                        <Button
                          variant="secondary"
                          onClick={() => invite(r)}
                          disabled={pending && pendingId === r.personId}
                          className="px-2.5 py-1.5 text-xs"
                        >
                          <UserPlus className="size-4" aria-hidden />
                          {r.accountStatus === 'PENDING' ? t('dir.reinvite') : t('dir.invite')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-extrabold tabular-nums text-label">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-label-3">{label}</p>
    </Card>
  );
}
