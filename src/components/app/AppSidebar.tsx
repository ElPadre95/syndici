'use client';

import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  Send,
  CalendarClock,
  CreditCard,
  Receipt,
  FileText,
  FileSignature,
  BellRing,
  Newspaper,
  Settings,
  Menu,
  X,
  Eye,
  MessageCircle,
  TriangleAlert,
  FileBarChart2,
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
// Les entrées SYNDIC ne sont montrées qu'au staff : un résident ne doit voir
// aucune fonction de gestion (A7 §1).
const STAFF_NAV: readonly NavItem[] = [
  { href: '/residences', key: 'residences', Icon: Building2 },
  { href: '/lots', key: 'lots', Icon: DoorOpen },
  { href: '/residents', key: 'residents', Icon: Users },
  { href: '/invitations', key: 'invitations', Icon: Send },
  { href: '/charges', key: 'charges', Icon: CalendarClock },
  { href: '/paiements', key: 'payments', Icon: CreditCard },
  { href: '/relances', key: 'reminders', Icon: BellRing },
  { href: '/depenses', key: 'expenses', Icon: Receipt },
  { href: '/contrats', key: 'contracts', Icon: FileSignature },
  { href: '/bilan', key: 'annual', Icon: FileBarChart2 },
  { href: '/incidents', key: 'incidents', Icon: TriangleAlert },
  { href: '/actualites', key: 'news', Icon: Newspaper },
  { href: '/documents', key: 'documents', Icon: FileText },
  { href: '/messagerie', key: 'messages', Icon: MessageCircle },
  { href: '/reglages', key: 'settings', Icon: Settings },
];
// L'accueil est neutre (pas une fonction de gestion) : commun à tous les rôles.
const HOME_NAV: NavItem = { href: '/', key: 'dashboard', Icon: LayoutDashboard };

// Navigation PROPRIÉTAIRE (tranche G) — peu d'entrées, pensée mobile. Elle grandit par
// incrément (G2 : mes charges ; G3 : transparence ; G4 : messagerie). « Jamais de lien
// mort » : on n'ajoute une entrée que quand son écran existe.
const OWNER_NAV: readonly NavItem[] = [
  { href: '/proprietaire/charges', key: 'myCharges', Icon: CreditCard },
  { href: '/proprietaire/incidents', key: 'incidents', Icon: TriangleAlert },
  { href: '/proprietaire/transparence', key: 'transparency', Icon: Eye },
];

/** Variante de navigation selon le rôle effectif : staff, propriétaire, ou locataire (minimal). */
export type NavVariant = 'staff' | 'owner' | 'tenant';

/** Détermine l'entrée active : correspondance exacte pour l'accueil, préfixe sinon. */
function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ appName }: { appName: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-md bg-grad-indigo text-sm font-extrabold text-white">
        S
      </span>
      <span className="font-serif text-2xl tracking-tight text-label">{appName}</span>
    </div>
  );
}

/**
 * Navigation (R1). Barre latérale fixe sur grand écran ; sur mobile elle se replie en
 * une barre compacte (marque + menu) qui ouvre un tiroir — le contenu reste utilisable
 * en petite largeur. Positionnement logique partout (le tiroir s'ouvre du côté du texte).
 */
export function AppSidebar({ variant }: { variant: NavVariant }) {
  const t = useTranslations('app.nav');
  const tCommon = useTranslations('common');
  const tHeader = useTranslations('app.header');
  const tBtn = useTranslations('buttons');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items =
    variant === 'staff'
      ? [HOME_NAV, ...STAFF_NAV]
      : variant === 'owner'
        ? [HOME_NAV, ...OWNER_NAV]
        : [HOME_NAV];

  const navLinks = (onNavigate?: () => void): ReactNode => (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, key, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={key}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md border-s-2 py-2 pe-3 ps-3 text-body font-semibold transition-colors',
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
  );

  return (
    <>
      {/* Barre latérale — grand écran */}
      <aside
        data-print-hide
        className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 border-e border-sep bg-card pb-6 pe-3 ps-4 pt-6 lg:flex"
      >
        <div className="mb-7 ps-2">
          <Brand appName={tCommon('appName')} />
        </div>
        {navLinks()}
      </aside>

      {/* Barre compacte — mobile / tablette */}
      <div
        data-print-hide
        className="sticky top-0 z-30 flex items-center justify-between border-b border-sep bg-card px-4 py-3 lg:hidden"
      >
        <Brand appName={tCommon('appName')} />
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
              <Brand appName={tCommon('appName')} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tBtn('btnClose')}
                className="rounded-md p-1.5 text-label-3 transition-colors hover:bg-bg"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {navLinks(() => setOpen(false))}
          </div>
        </div>
      )}
    </>
  );
}
