'use client';

import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  Send,
  CreditCard,
  Receipt,
  FileText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  key: string;
  Icon: LucideIcon;
}

// Chaque entrée mène à un écran RÉEL (jamais de lien mort — cf. A4).
const NAV: readonly NavItem[] = [
  { href: '/', key: 'dashboard', Icon: LayoutDashboard },
  { href: '/residences', key: 'residences', Icon: Building2 },
  { href: '/lots', key: 'lots', Icon: DoorOpen },
  { href: '/residents', key: 'residents', Icon: Users },
  { href: '/invitations', key: 'invitations', Icon: Send },
  { href: '/paiements', key: 'payments', Icon: CreditCard },
  { href: '/depenses', key: 'expenses', Icon: Receipt },
  { href: '/documents', key: 'documents', Icon: FileText },
  { href: '/reglages', key: 'settings', Icon: Settings },
];

/** Détermine l'entrée active : correspondance exacte pour l'accueil, préfixe sinon. */
function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const t = useTranslations('app.nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-1 border-e border-sep bg-white pb-6 pe-3 ps-4 pt-6">
      <div className="mb-6 ps-2">
        <span className="font-serif text-2xl text-label">{tCommon('appName')}</span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, key, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md border-s-2 py-2 pe-3 ps-3 text-sm font-semibold transition-colors',
                active
                  ? 'border-indigo bg-indigo-soft text-indigo'
                  : 'border-transparent text-label-3 hover:bg-bg hover:text-label',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span>{t(key)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
