'use client';

import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { LogOut, UserCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

interface AppHeaderProps {
  userLabel: string | null;
  residencesCount: number;
}

/**
 * En-tête de l'application connectée. Lit l'identité de session (transmise par le
 * layout serveur) : affiche l'utilisateur et le nombre de résidences accessibles,
 * ou un état « non connecté » avec accès à la connexion. Contient le sélecteur de
 * langue (bascule fr ⇄ ar sans quitter la page).
 */
export function AppHeader({ userLabel, residencesCount }: AppHeaderProps) {
  const t = useTranslations('app.header');

  return (
    <header className="flex items-center justify-between gap-4 border-b border-sep bg-white px-6 py-3">
      <div className="flex items-center gap-2 text-sm text-label-3">
        <UserCircle2 className="size-5 text-label-4" aria-hidden />
        {userLabel ? (
          <span className="flex items-center gap-2">
            <span className="font-semibold text-label">{userLabel}</span>
            <span className="text-label-4">·</span>
            <span>{t('residencesCount', { count: residencesCount })}</span>
          </span>
        ) : (
          <span>{t('guest')}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
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
