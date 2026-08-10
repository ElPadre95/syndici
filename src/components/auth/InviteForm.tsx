'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { verifyInviteAction, onboardAction } from '@/server/auth/actions';

/**
 * Écran d'activation par code d'invitation (§5). Deux étapes :
 *   1. saisie du code → vérification (n'expose au plus qu'un e-mail MASQUÉ,
 *      jamais de préremplissage ni de nom) ;
 *   2. choix e-mail + mot de passe → activation (liaison unique, irréversible).
 * Aucune PII n'est affichée. Les messages d'erreur sont génériques.
 */
export function InviteForm() {
  const t = useTranslations('auth.invite');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'code' | 'account' | 'done'>('code');
  const [role, setRole] = useState<'OWNER' | 'TENANT' | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function errText(reason: string): string {
    // clés sous auth.invite.errors ; repli sur 'invalid'
    return t.has(`errors.${reason}`) ? t(`errors.${reason}`) : t('errors.invalid');
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await verifyInviteAction(code);
    setPending(false);
    if (res.status === 'valid') {
      setRole(res.role);
      setMaskedEmail(res.maskedEmail);
      setStep('account');
    } else {
      setError(errText(res.reason));
    }
  }

  async function onActivate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await onboardAction({ code, email, password });
    setPending(false);
    if (res.status === 'ok') setStep('done');
    else setError(errText(res.reason));
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold text-label">{t('title')}</h1>
        <p className="text-sm text-label-3">{t('success')}</p>
        <Link href="/sign-in" className="font-semibold text-indigo">
          {t('backToSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-label">{t('title')}</h1>
        <p className="mt-1 text-sm text-label-3">{t('subtitle')}</p>
      </div>

      {step === 'code' && (
        <form className="flex flex-col gap-3" onSubmit={onVerify}>
          <label className="flex flex-col gap-1 text-sm font-semibold text-label">
            {t('codeLabel')}
            <input
              type="text"
              required
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-md border border-sep px-3 py-2 font-mono tracking-widest"
            />
          </label>
          {error && <p className="text-sm text-red">{error}</p>}
          <Button type="submit" disabled={pending}>
            {t('verify')}
          </Button>
        </form>
      )}

      {step === 'account' && role && (
        <form className="flex flex-col gap-3" onSubmit={onActivate}>
          <p className="text-sm text-label-3">
            {t('verifiedNote', { role: role === 'OWNER' ? t('roleOwner') : t('roleTenant') })}
          </p>
          {maskedEmail && (
            <p className="text-sm text-label-4">{t('maskedEmailNote', { email: maskedEmail })}</p>
          )}
          <p className="text-sm font-semibold text-label">{t('createTitle')}</p>
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
              minLength={10}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-sep px-3 py-2 font-normal"
            />
          </label>
          {error && <p className="text-sm text-red">{error}</p>}
          <Button type="submit" disabled={pending}>
            {t('create')}
          </Button>
        </form>
      )}
    </div>
  );
}
