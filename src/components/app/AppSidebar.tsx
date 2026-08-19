'use client';

import { useState, type ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import { Menu, X, LogOut, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { STAFF_GROUPS, OWNER_ITEMS, isActivePath, activeStaffGroup } from './nav-model';

/** Variante de navigation selon le rôle effectif : staff, propriétaire, ou locataire (minimal). */
export type NavVariant = 'staff' | 'owner' | 'tenant';

interface Entry {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  badge: number;
}

function Brand() {
  return (
    <span className="flex size-7 items-center justify-center rounded-md bg-grad-indigo text-sm font-extrabold text-white">
      S
    </span>
  );
}

/**
 * Navigation (R1). Sur grand écran, un RAIL réduit (icônes) qui s'élargit au survol en
 * recouvrant le contenu (voir `app-nav.css`) ; jamais de menu déroulant — chaque entrée ouvre
 * directement sa page. « Se déconnecter » est TOUT EN BAS du rail, séparée, atteignable même
 * repliée. Sur mobile, une barre compacte ouvre un tiroir. Positionnement logique (miroir RTL).
 */
export function AppSidebar({ variant, unread = 0 }: { variant: NavVariant; unread?: number }) {
  const tGroups = useTranslations('app.groups');
  const tNav = useTranslations('app.nav');
  const tCommon = useTranslations('common');
  const tHeader = useTranslations('app.header');
  const tBtn = useTranslations('buttons');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const staffGroup = activeStaffGroup(pathname);
  const entries: Entry[] =
    variant === 'staff'
      ? STAFF_GROUPS.map((g) => ({
          href: g.href,
          label: tGroups(g.key),
          Icon: g.Icon,
          active: staffGroup?.key === g.key,
          badge: g.badge === 'messages' ? unread : 0,
        }))
      : variant === 'owner'
        ? OWNER_ITEMS.map((i) => ({
            href: i.href,
            label: tNav(i.key),
            Icon: i.Icon,
            active: isActivePath(pathname, i.href),
            badge: 0,
          }))
        : OWNER_ITEMS.slice(0, 1).map((i) => ({
            href: i.href,
            label: tNav(i.key),
            Icon: i.Icon,
            active: isActivePath(pathname, i.href),
            badge: 0,
          }));

  const badgeEl = (n: number, compact: boolean) =>
    n > 0 ? (
      <span
        className={cn(
          'flex min-w-[1.15rem] items-center justify-center rounded-full bg-red px-1 text-[0.65rem] font-bold leading-4 text-white',
          compact ? 'absolute -top-1.5 end-2.5' : '',
        )}
        aria-hidden
      >
        {n > 9 ? '9+' : n}
      </span>
    ) : null;

  // Entrée du RAIL (grand écran) : zone d'icône centrée (visible repliée) + libellé (au survol).
  const railEntry = ({ href, label, Icon, active, badge }: Entry) => (
    <Link
      key={href + label}
      href={href}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-11 items-center text-body font-semibold transition-colors',
        active ? 'text-indigo' : 'text-label-3 hover:text-label',
      )}
    >
      {active && <span className="absolute start-0 inset-y-1.5 w-0.5 rounded-e bg-indigo" aria-hidden />}
      <span className="relative flex w-16 shrink-0 items-center justify-center">
        <Icon className="size-5" aria-hidden />
        {badgeEl(badge, true)}
      </span>
      <span className="whitespace-nowrap pe-4">{label}</span>
    </Link>
  );

  // Entrée du TIROIR (mobile) : icône + libellé toujours visibles.
  const drawerEntry = ({ href, label, Icon, active, badge }: Entry) => (
    <Link
      key={href + label}
      href={href}
      onClick={() => setOpen(false)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md border-s-2 py-2 pe-3 ps-3 text-body font-semibold transition-colors',
        active
          ? 'border-indigo bg-indigo-soft text-indigo'
          : 'border-transparent text-label-3 hover:bg-bg hover:text-label',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{label}</span>
      {badgeEl(badge, false)}
    </Link>
  );

  const signOutBtn = (compact: boolean): ReactNode =>
    compact ? (
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/' })}
        title={tHeader('signOut')}
        className="flex h-11 w-full items-center text-body font-semibold text-label-3 transition-colors hover:text-label"
      >
        <span className="flex w-16 shrink-0 items-center justify-center">
          <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
        </span>
        <span className="whitespace-nowrap pe-4">{tHeader('signOut')}</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/' })}
        className="flex w-full items-center gap-3 rounded-md py-2 pe-3 ps-3 text-body font-semibold text-label-3 transition-colors hover:bg-bg hover:text-label"
      >
        <LogOut className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden />
        <span>{tHeader('signOut')}</span>
      </button>
    );

  return (
    <>
      {/* RAIL — grand écran : réduit en permanence, élargi au survol (app-nav.css) */}
      <aside
        data-print-hide
        className="app-rail fixed start-0 top-0 z-30 hidden h-screen flex-col overflow-hidden border-e border-sep bg-card lg:flex"
      >
        <div className="flex h-14 shrink-0 items-center">
          <span className="flex w-16 shrink-0 items-center justify-center">
            <Brand />
          </span>
          <span className="whitespace-nowrap font-serif text-2xl tracking-tight text-label">
            {tCommon('appName')}
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 py-2">{entries.map(railEntry)}</nav>
        {/* Déconnexion — tout en bas, séparée, atteignable même repliée */}
        <div className="shrink-0 border-t border-sep py-2">{signOutBtn(true)}</div>
      </aside>

      {/* Barre compacte — mobile / tablette */}
      <div
        data-print-hide
        className="sticky top-0 z-30 flex items-center justify-between border-b border-sep bg-card px-4 py-3 lg:hidden"
      >
        <div className="flex items-center gap-2">
          <Brand />
          <span className="font-serif text-2xl tracking-tight text-label">{tCommon('appName')}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={tHeader('menu')}
          aria-expanded={open}
          className="rounded-md p-1.5 text-label-2 transition-colors hover:bg-bg"
        >
          <Menu className="size-6" aria-hidden />
        </button>
      </div>

      {/* Tiroir de navigation — mobile */}
      {open && (
        <div data-print-hide className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={tBtn('btnClose')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[82%] animate-popup-in flex-col overflow-y-auto border-e border-sep bg-card p-4 shadow-md">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brand />
                <span className="font-serif text-2xl tracking-tight text-label">{tCommon('appName')}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tBtn('btnClose')}
                className="rounded-md p-1.5 text-label-3 transition-colors hover:bg-bg"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1">{entries.map(drawerEntry)}</nav>
            <div className="mt-2 border-t border-sep pt-2">{signOutBtn(false)}</div>
          </div>
        </div>
      )}
    </>
  );
}
