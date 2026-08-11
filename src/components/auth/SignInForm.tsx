'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';

/**
 * Écran de connexion (§1) — deux méthodes : e-mail+mot de passe et lien magique.
 * Volontairement sans travail de design. Aucun préremplissage, aucun message
 * distinctif qui permettrait d'énumérer les comptes.
 */
export function SignInForm({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const t = useTranslations('auth.signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await signIn('password', { email, password, redirect: false });
    setPending(false);
    if (res?.error) setError(t('invalid'));
    else window.location.assign(callbackUrl);
  }

  async function onMagic() {
    if (!email) return;
    setPending(true);
    setError(null);
    await signIn('magic-link', { email, redirect: false });
    setPending(false);
    setMagicSent(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-label">{t('title')}</h1>
        <p className="mt-1 text-sm text-label-3">{t('subtitle')}</p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={onPassword}>
        <label className="flex flex-col gap-1 text-sm font-semibold text-label">
          {t('emailLabel')}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-sep px-3 py-2 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-label">
          {t('passwordLabel')}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-sep px-3 py-2 font-normal"
          />
        </label>
        {error && <p className="text-sm text-red">{error}</p>}
        <Button type="submit" disabled={pending}>
          {t('submit')}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs uppercase text-label-4">
        <span className="h-px flex-1 bg-sep" />
        {t('orSeparator')}
        <span className="h-px flex-1 bg-sep" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-label">{t('magicTitle')}</p>
        {magicSent ? (
          <p className="text-sm text-label-3">{t('magicSent')}</p>
        ) : (
          <Button variant="secondary" onClick={onMagic} disabled={pending || !email}>
            {t('magicSubmit')}
          </Button>
        )}
      </div>

      <p className="text-sm text-label-3">
        {t('noAccount')}{' '}
        <Link href="/invite" className="font-semibold text-indigo">
          {t('inviteLink')}
        </Link>
      </p>
    </div>
  );
}
