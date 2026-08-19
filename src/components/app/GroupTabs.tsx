'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { STAFF_GROUPS, isActivePath } from './nav-model';

/**
 * Onglets in-page (R1) — à l'intérieur d'un groupe du syndic, on passe d'un écran à l'autre
 * par des onglets, sans repasser par la barre latérale. Rendu au-dessus du contenu par le
 * layout ; il déduit le groupe courant du chemin. Rien à afficher hors d'un groupe (tableau
 * de bord, écrans propriétaire, écrans non listés). Aucune URL ne change.
 */
export function GroupTabs() {
  const pathname = usePathname();
  const t = useTranslations('app.nav');
  const group = STAFF_GROUPS.find(
    (g) => g.tabs.length > 0 && g.tabs.some((tab) => isActivePath(pathname, tab.href)),
  );
  if (!group) return null;

  return (
    <nav
      data-print-hide
      aria-label={group.key}
      className="mb-7 flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-sep"
    >
      {group.tabs.map((tab) => {
        const active = isActivePath(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2.5 text-body font-semibold transition-colors',
              active
                ? 'border-indigo text-indigo'
                : 'border-transparent text-label-3 hover:text-label',
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
