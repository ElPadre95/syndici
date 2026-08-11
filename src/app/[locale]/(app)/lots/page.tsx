import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DoorOpen, Plus, Sparkles, AlertTriangle, Building2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { BoardTable } from '@/components/lots/BoardTable';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listLotsForBoard } from '@/server/lots/board';
import { quotePartTotal } from '@/server/lots/data';
import { QUOTE_PART_TARGET } from '@/server/lots/validation';

export default async function LotsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('lots.list');
  const tb = await getTranslations('lots.board');

  const ctx = await getSessionContext();
  const active = ctx?.residences.find((r) => r.id === ctx.activeId) ?? null;

  if (!ctx?.activeId || !ctx.role || !active) {
    return (
      <EmptyState
        icon={<Building2 className="size-6" aria-hidden />}
        title={t('noActiveTitle')}
        body={t('noActiveBody')}
      />
    );
  }
  if (!can(ctx.role, 'lot.view.all')) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
          {t('noActiveBody')}
        </p>
      </div>
    );
  }

  const { rows, kpis } = await listLotsForBoard({
    personId: ctx.personId,
    residenceId: ctx.activeId,
    role: ctx.role,
  });
  const total = await quotePartTotal(ctx.activeId);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
          <p className="mt-1 text-sm text-label-3">
            {t('subtitle', { residence: active.name, count: rows.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/lots/generer">
            <Button variant="secondary">
              <Sparkles className="size-4" aria-hidden />
              {t('generateCta')}
            </Button>
          </Link>
          <Link href="/lots/nouveau">
            <Button variant="primary">
              <Plus className="size-4" aria-hidden />
              {t('addCta')}
            </Button>
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="size-6" aria-hidden />}
          title={t('emptyTitle')}
          body={t('emptyBody')}
          action={
            <Link href="/lots/generer" className="mt-2">
              <Button variant="primary">{t('generateCta')}</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              value={kpis.total}
              label={tb('kpiLots')}
              sub={tb('kpiSplit', { appt: kpis.apartments, villa: kpis.villas })}
            />
            <Kpi value={kpis.ownersAbroad} label={tb('kpiAbroad')} tone="indigo" />
            <Kpi value={kpis.settledThisMonth} label={tb('kpiSettled')} tone="green" />
            <Kpi value={kpis.overdue} label={tb('kpiOverdue')} tone="red" />
          </div>

          {total !== QUOTE_PART_TARGET && (
            <p className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {t('quotePartWarning', { total })}
            </p>
          )}

          <BoardTable rows={rows} />
        </>
      )}
    </div>
  );
}

function Kpi({
  value,
  label,
  sub,
  tone,
}: {
  value: number;
  label: string;
  sub?: string;
  tone?: 'indigo' | 'green' | 'red';
}) {
  const toneClass =
    tone === 'indigo'
      ? 'text-indigo'
      : tone === 'green'
        ? 'text-green'
        : tone === 'red'
          ? 'text-red'
          : 'text-label';
  return (
    <div className="rounded-lg border border-sep bg-white px-4 py-3">
      <div className={`text-2xl font-extrabold ${toneClass}`}>{value}</div>
      <div className="mt-0.5 text-xs font-semibold text-label-3">{label}</div>
      {sub && <div className="text-xs text-label-4">{sub}</div>}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
          {icon}
        </span>
        <p className="text-base font-bold text-label">{title}</p>
        <p className="max-w-sm text-sm text-label-3">{body}</p>
        {action}
      </div>
    </div>
  );
}
