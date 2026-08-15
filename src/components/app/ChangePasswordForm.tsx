'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { changeOwnPasswordAction } from '@/server/auth/profile-actions';

/**
 * Changement de mot de passe (H7) — EXIGE l'ancien. Le nouveau est confirmé côté client ;
 * la vérification de l'ancien et la longueur minimale sont refaites côté serveur.
 */
export function ChangePasswordForm({ minLength }: { minLength: number }) {
  const t = useTranslations('profile');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData): void {
    setMsg(null);
    const next = String(fd.get('newPassword') ?? '');
    const confirm = String(fd.get('confirmPassword') ?? '');
    if (next.length < minLength) {
      setMsg({ ok: false, text: t('pwWeak', { n: minLength }) });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: t('pwMismatch') });
      return;
    }
    start(async () => {
      const res = await changeOwnPasswordAction(fd);
      if (res.ok) {
        setMsg({ ok: true, text: t('pwChanged') });
        formRef.current?.reset();
      } else {
        setMsg({
          ok: false,
          text:
            res.error === 'wrong_old'
              ? t('pwWrongOld')
              : res.error === 'weak'
                ? t('pwWeak', { n: minLength })
                : t('error'),
        });
      }
    });
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-col gap-4 rounded-lg border border-sep bg-card p-5">
      <p className="text-section font-bold text-label">{t('pwTitle')}</p>
      <Field name="oldPassword" label={t('pwOld')} type="password" autoComplete="current-password" required />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field name="newPassword" label={t('pwNew')} type="password" autoComplete="new-password" required />
        <Field name="confirmPassword" label={t('pwConfirm')} type="password" autoComplete="new-password" required />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="subtle" loading={pending}>
          {pending ? t('saving') : t('pwSubmit')}
        </Button>
        {msg && (
          <span className={`text-note font-semibold ${msg.ok ? 'text-green' : 'text-red'}`}>{msg.text}</span>
        )}
      </div>
    </form>
  );
}
