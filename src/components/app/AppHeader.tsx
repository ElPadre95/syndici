'use client';

import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { LogOut, UserCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { ResidenceSwitcher, type SwitcherResidence } from '@/components/app/ResidenceSwitcher';

interface AppHeaderProps {
  userLabel: string | null;
  residences: SwitcherResidence[];
  activeId: string | null;
}

/**
 * En-tête de l'application connectée. Affiche l'utilisateur, le sélecteur de
 * résidence active (§4), le sélecteur de langue, et la déconnexion. L'identité et
 * la liste des résidences proviennent du contexte de session (layout serveur).
 */
export function AppHeader({ userLabel, residences, activeId }: AppHeaderProps) {
  const t = useTranslations('app.header');

  return (
    <header
      data-print-hide
      className="bg-card/90 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-sep px-4 py-3 backdrop-blur sm:px-6 lg:sticky lg:top-0"
    >
      <div className="flex items-center gap-3">
        {residences.length > 0 && <ResidenceSwitcher residences={residences} activeId={activeId} />}
        <span className="hidden items-center gap-2 text-body text-label-3 sm:flex">
          <UserCircle2 className="size-5 text-label-4" aria-hidden />
          {userLabel ? (
            <span className="font-semibold text-label">{userLabel}</span>
          ) : (
            <span>{t('guest')}</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        {userLabel ? (
          <Button variant="ghost" onClick={() => signOut({ callbackUrl: '/' })}>
            <LogOut className="size-4" aria-hidden />
            {t('signOut')}
          </Button>
        ) : (
          <Link href="/sign-in">
            <Button variant="primary">{t('signIn')}</Button>
          </Link>
        )}
      </div>
    </header>
  );
}
