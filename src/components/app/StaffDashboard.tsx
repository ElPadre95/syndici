import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  DoorOpen,
  Wallet,
  BellRing,
  FileSignature,
  ArrowRight,
  AlertTriangle,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { StaffDashboard as Data } from '@/server/finance/dashboard';
import type { ResidencePayments } from '@/server/finance/payments';
import type { ExpenseList } from '@/server/finance/expenses';
import type { ContractView } from '@/server/finance/contracts';

/**
 * Tableau de bord du syndic (R1) — l'écran principal. Hiérarchie : d'abord ce qui appelle
 * une action (impayés, contrats qui expirent), puis l'argent en bloc dominant, puis la
 * collecte du mois, puis des listes courtes cliquables. Toutes les données proviennent des
 * lectures existantes (tranches B/C/E), parallélisées côté page — aucune agrégation nouvelle.
 */
export async function StaffDashboard({
  name,
  residenceName,
  data,
  payments,
  expenses,
  contracts,
}: {
  name: string | null;
  residenceName: string;
  data: Data;
  payments: ResidencePayments;
  expenses: ExpenseList;
  contracts: ContractView[];
}) {
  const t = await getTranslations('app.dashboard');
  const tPay = await getTranslations('payments');
  const tContract = await getTranslations('contracts');
  const locale = await getLocale();

  const fmt = (m: number) => formatMoney(m, locale);
  const fmtDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const day = (iso: string) => fmtDate.format(new Date(iso));

  // Dérivés du mois calendaire courant, à partir des lignes DÉJÀ chargées (aucune requête
  // de plus). L'encaissé du mois est canonique (getStaffDashboard) ; le dépensé du mois est
  // la somme des dépenses de ce mois (hors annulations) issues de la liste déjà récupérée.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const inMonth = (iso: string) => new Date(iso) >= monthStart;
  const spentThisMonthMinor = expenses.rows
    .filter((r) => !r.isReversal && !r.reversed && inMonth(r.spentOn))
    .reduce((s, r) => s + r.amountMinor, 0);
  const collectedMonth = data.collectedThisMonthMinor;
  const netMonth = collectedMonth - spentThisMonthMinor;

  // Collecte de la campagne en cours (canonique).
  const period = data.current
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        new Date(data.current.year, data.current.month - 1, 1),
      )
    : null;
  const rate = data.current ? Math.round(data.current.collectionRate * 100) : null;
  const collected = data.current?.collectedMinor ?? 0;
  const remaining = data.current?.remainingMinor ?? 0;
  const called = collected + remaining;

  const recentPayments = payments.rows.filter((r) => !r.isReversal).slice(0, 5);
  const recentExpenses = expenses.rows.filter((r) => !r.isReversal).slice(0, 5);
  const expiring = contracts.filter((c) => c.tier === 'soon' || c.tier === 'expired').slice(0, 5);

  const countdown = (c: ContractView) =>
    c.tier === 'expired'
      ? tContract('countdown.expired')
      : c.daysUntil === 0
        ? tContract('countdown.today')
        : tContract('countdown.days', { days: c.daysUntil });

  return (
    <div className="mx-auto flex max-w-5xl animate-rise-in flex-col gap-6">
      {/* En-tête */}
      <header className="flex flex-col gap-1">
        <p className="text-eyebrow font-bold uppercase text-indigo">
          {t('staff.residenceLabel', { residence: residenceName })}
        </p>
        <h1 className="text-title text-label">
          {name ? t('welcome', { name }) : t('welcomeGuest')}
        </h1>
      </header>

      {/* 1. À TRAITER — impayés + contrats qui expirent */}
      {(data.dunningCount > 0 || expiring.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.dunningCount > 0 && (
            <ActionBanner href="/relances" Icon={BellRing}>
              {t('staff.dunning', { count: data.dunningCount })}
              <span className="text-orange/80 ms-1 font-semibold">{t('staff.dunningAuto')}</span>
            </ActionBanner>
          )}
          {expiring.length > 0 && (
            <ActionBanner href="/contrats" Icon={FileSignature}>
              {t('staff.contractsExpiring')}
              <span className="text-orange/80 ms-1 font-semibold">· {expiring.length}</span>
            </ActionBanner>
          )}
        </div>
      )}

      {/* 2. L'ARGENT — bloc large et dominant */}
      <section className="relative overflow-hidden rounded-lg bg-grad-indigo p-6 text-white shadow-md">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 end-[-40px] size-52 rounded-full bg-white/10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[-70px] end-24 size-40 rounded-full bg-white/[0.06]"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-eyebrow font-bold uppercase text-white/70">{t('staff.available')}</p>
            <p className="mt-1 text-display font-extrabold tabular-nums">
              {fmt(data.treasury.netMinor)}
            </p>
          </div>
          <Link
            href="/paiements"
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-body font-bold text-indigo shadow-sm transition-transform hover:scale-[1.03]"
          >
            <Wallet className="size-4" aria-hidden />
            {t('staff.record')}
          </Link>
        </div>
        <div className="relative mt-5 grid grid-cols-1 gap-3 border-t border-white/15 pt-4 sm:grid-cols-3 sm:gap-4">
          <MoneyChip label={t('staff.collectedMonth')} value={fmt(collectedMonth)} />
          <MoneyChip label={t('staff.spentMonth')} value={`−${fmt(spentThisMonthMinor)}`} />
          <MoneyChip label={t('staff.netMonth')} value={fmt(netMonth)} strong />
        </div>
      </section>

      {/* 3. LE MOIS EN COURS — collecte + chiffres clés */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-eyebrow font-bold uppercase text-label-4">{t('staff.rate')}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-stat font-extrabold tabular-nums text-label">
                  {rate === null ? '—' : `${rate}%`}
                </span>
                {period && (
                  <span className="text-note text-label-3">
                    {t('staff.collection', { period })}
                  </span>
                )}
              </p>
            </div>
            <Link
              href="/charges"
              className="inline-flex items-center gap-1 text-note font-semibold text-indigo hover:underline"
            >
              {t('staff.viewAll')}
              <ArrowRight className="size-3 rtl:-scale-x-100" aria-hidden />
            </Link>
          </div>
          <div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-bg">
              <div
                className="h-full rounded-full bg-indigo"
                style={{ width: `${Math.min(100, Math.max(0, rate ?? 0))}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-note">
              <span className="font-semibold tabular-nums text-label-2">
                {t('staff.ofCalled', { collected: fmt(collected), called: fmt(called) })}
              </span>
              <span className="text-label-3">
                {t('staff.toCollect')} <b className="tabular-nums text-label-2">{fmt(remaining)}</b>
              </span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <StatTile
            href="/lots"
            Icon={DoorOpen}
            label={t('staff.lots')}
            value={String(data.lots)}
          />
          <StatTile
            href="/charges"
            Icon={AlertTriangle}
            label={t('staff.remaining')}
            value={fmt(data.totalRemainingMinor)}
          />
        </div>
      </div>

      {/* 4. LISTES COURTES — cliquables vers l'écran complet */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ListCard title={t('staff.recentPayments')} href="/paiements" viewAll={t('staff.viewAll')}>
          {recentPayments.length === 0 ? (
            <Empty>{t('staff.nothingYet')}</Empty>
          ) : (
            recentPayments.map((p) => (
              <Row
                key={p.id}
                primary={p.payerName ?? p.lotReference ?? '—'}
                secondary={`${day(p.receivedAt)} · ${tPay(`method.${p.method}`)}`}
                amount={fmt(p.amountMinor)}
                tone="success"
              />
            ))
          )}
        </ListCard>

        <ListCard title={t('staff.recentExpenses')} href="/depenses" viewAll={t('staff.viewAll')}>
          {recentExpenses.length === 0 ? (
            <Empty>{t('staff.nothingYet')}</Empty>
          ) : (
            recentExpenses.map((e) => (
              <Row
                key={e.id}
                Icon={Receipt}
                primary={e.supplierName ?? e.description}
                secondary={`${day(e.spentOn)}${e.categoryLabel ? ` · ${e.categoryLabel}` : ''}`}
                amount={`−${fmt(e.amountMinor)}`}
              />
            ))
          )}
        </ListCard>

        <ListCard
          title={t('staff.contractsExpiring')}
          href="/contrats"
          viewAll={t('staff.viewAll')}
        >
          {expiring.length === 0 ? (
            <Empty>{t('staff.nothingYet')}</Empty>
          ) : (
            expiring.map((c) => (
              <Row
                key={c.id}
                Icon={FileSignature}
                primary={c.name}
                secondary={tContract('due', { date: day(c.endDate) })}
                badge={
                  <Badge tone={c.tier === 'expired' ? 'danger' : 'warning'}>{countdown(c)}</Badge>
                }
              />
            ))
          )}
        </ListCard>
      </div>
    </div>
  );
}

/* ── Sous-composants de présentation (locaux au tableau de bord) ─────────────── */

function ActionBanner({
  href,
  Icon,
  children,
}: {
  href: '/relances' | '/contrats';
  Icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="border-orange/25 group flex items-center justify-between gap-3 rounded-lg border bg-orange-soft px-4 py-3 transition-colors hover:border-orange"
    >
      <span className="flex items-center gap-3">
        <Icon className="size-5 shrink-0 text-orange" aria-hidden />
        <span className="text-body font-bold text-orange">{children}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-orange rtl:-scale-x-100" aria-hidden />
    </Link>
  );
}

function MoneyChip({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-eyebrow font-semibold uppercase text-white/60">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-body tabular-nums',
          strong ? 'font-extrabold' : 'font-bold text-white/90',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StatTile({
  href,
  Icon,
  label,
  value,
}: {
  href: '/lots' | '/charges';
  Icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg border border-sep bg-card p-4 shadow-sm transition-colors hover:border-indigo"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-soft text-indigo">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-stat font-extrabold tabular-nums leading-none text-label">
          {value}
        </span>
        <span className="mt-1 block truncate text-note text-label-3">{label}</span>
      </span>
    </Link>
  );
}

function ListCard({
  title,
  href,
  viewAll,
  children,
}: {
  title: string;
  href: '/paiements' | '/depenses' | '/contrats';
  viewAll: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-section font-bold text-label">{title}</h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-note font-semibold text-indigo hover:underline"
        >
          {viewAll}
          <ArrowRight className="size-3 rtl:-scale-x-100" aria-hidden />
        </Link>
      </div>
      <ul className="flex flex-col divide-y divide-sep">{children}</ul>
    </Card>
  );
}

function Row({
  Icon,
  primary,
  secondary,
  amount,
  tone,
  badge,
}: {
  Icon?: LucideIcon;
  primary: string;
  secondary: string;
  amount?: string;
  tone?: 'success';
  badge?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5 text-body">
      {Icon && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bg text-label-4">
          <Icon className="size-4" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-label">{primary}</span>
        <span className="block truncate text-note text-label-3">{secondary}</span>
      </span>
      {amount && (
        <span
          className={cn(
            'shrink-0 font-bold tabular-nums',
            tone === 'success' ? 'text-green' : 'text-label-2',
          )}
        >
          {amount}
        </span>
      )}
      {badge}
    </li>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <li className="py-6 text-center text-note text-label-4">{children}</li>;
}
