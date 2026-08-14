import { getLocale, getTranslations } from 'next-intl/server';
import {
  DoorOpen,
  TrendingUp,
  AlertTriangle,
  Wallet,
  ArrowRight,
  Landmark,
  BellRing,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import type { StaffDashboard as Data } from '@/server/finance/dashboard';

/**
 * Accueil du staff pour une résidence active (correctif de la coquille A1). Sobre :
 * quatre chiffres justes + des liens vers les écrans existants. Pas un tableau de
 * bord complet — ce sera pour plus tard.
 */
export async function StaffDashboard({
  name,
  residenceName,
  data,
}: {
  name: string | null;
  residenceName: string;
  data: Data;
}) {
  const t = await getTranslations('app.dashboard');
  const locale = await getLocale();

  const period = data.current
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        new Date(data.current.year, data.current.month - 1, 1),
      )
    : null;
  const rate = data.current ? Math.round(data.current.collectionRate * 100) : null;

  const tiles = [
    {
      key: 'lots',
      Icon: DoorOpen,
      value: String(data.lots),
      label: t('staff.lots'),
      href: '/lots' as const,
      cta: t('staff.viewLots'),
    },
    {
      key: 'collection',
      Icon: TrendingUp,
      value: rate === null ? '—' : `${rate}%`,
      label: period ? t('staff.collection', { period }) : t('staff.noCampaign'),
      href: '/charges' as const,
      cta: t('staff.viewCharges'),
    },
    {
      key: 'remaining',
      Icon: AlertTriangle,
      value: formatMoney(data.totalRemainingMinor, locale),
      label: t('staff.remaining'),
      href: '/charges' as const,
      cta: t('staff.viewCharges'),
    },
    {
      key: 'collected',
      Icon: Wallet,
      value: formatMoney(data.collectedThisMonthMinor, locale),
      label: t('staff.collectedMonth'),
      href: '/charges' as const,
      cta: t('staff.viewCharges'),
    },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo">
          {t('staff.residenceLabel', { residence: residenceName })}
        </p>
        <h1 className="text-3xl font-extrabold text-label">
          {name ? t('welcome', { name }) : t('welcomeGuest')}
        </h1>
      </header>

      {/* Bandeau « N résidents à relancer · détection auto » (moteur §7.1). */}
      {data.dunningCount > 0 && (
        <Link
          href="/relances"
          className="border-orange/30 group flex items-center justify-between gap-3 rounded-lg border bg-orange-soft px-4 py-3 transition-colors hover:border-orange"
        >
          <span className="flex items-center gap-3">
            <BellRing className="size-5 shrink-0 text-orange" aria-hidden />
            <span className="text-sm font-bold text-orange">
              {t('staff.dunning', { count: data.dunningCount })}
              <span className="text-orange/80 ms-2 font-semibold">{t('staff.dunningAuto')}</span>
            </span>
          </span>
          <ArrowRight className="size-4 text-orange rtl:-scale-x-100" aria-hidden />
        </Link>
      )}

      {/* Trésorerie réelle : encaissé − dépensé (tout l'historique). */}
      <Link
        href="/depenses"
        className="group flex flex-wrap items-center justify-between gap-4 rounded-lg border border-sep bg-white p-5 transition-colors hover:border-indigo"
      >
        <div className="flex items-center gap-4">
          <span className="flex size-11 items-center justify-center rounded-md bg-indigo-soft text-indigo">
            <Landmark className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-label-4">
              {t('staff.treasury')}
            </p>
            <p
              className={cn(
                'text-3xl font-extrabold tabular-nums',
                data.treasury.netMinor >= 0 ? 'text-green' : 'text-orange',
              )}
            >
              {formatMoney(data.treasury.netMinor, locale)}
            </p>
          </div>
        </div>
        <div className="flex gap-6 text-sm">
          <div className="text-end">
            <p className="text-xs font-semibold uppercase tracking-wide text-label-4">
              {t('staff.treasuryCollected')}
            </p>
            <p className="font-bold tabular-nums text-green">
              {formatMoney(data.treasury.collectedMinor, locale)}
            </p>
          </div>
          <div className="text-end">
            <p className="text-xs font-semibold uppercase tracking-wide text-label-4">
              {t('staff.treasurySpent')}
            </p>
            <p className="font-bold tabular-nums text-label">
              −{formatMoney(data.treasury.spentMinor, locale)}
            </p>
          </div>
        </div>
      </Link>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ key, Icon, value, label, href, cta }) => (
          <Link
            key={key}
            href={href}
            className="group flex flex-col gap-2 rounded-lg border border-sep bg-white p-4 transition-colors hover:border-indigo"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-indigo-soft text-indigo">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="mt-1 text-2xl font-extrabold tabular-nums text-label">{value}</span>
            <span className="text-sm text-label-3">{label}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo">
              {cta}
              <ArrowRight className="size-3 rtl:-scale-x-100" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
