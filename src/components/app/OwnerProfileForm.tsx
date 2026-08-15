'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { updateOwnProfileAction } from '@/server/auth/profile-actions';

/**
 * Fiche du propriétaire (H7) — il modifie SES informations : téléphone, langue préférée,
 * devise secondaire. Le nom, l'e-mail, le rattachement au lot et le rôle sont en lecture
 * seule (ils restent au syndic). La langue préférée pilote la langue des relances WhatsApp.
 */
export function OwnerProfileForm({
  fullName,
  email,
  phone,
  preferredLocale,
  secondaryCurrency,
  availableCurrencies,
}: {
  fullName: string;
  email: string | null;
  phone: string | null;
  preferredLocale: string;
  secondaryCurrency: string | null;
  availableCurrencies: string[];
}) {
  const t = useTranslations('profile');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save(fd: FormData): void {
    setMsg(null);
    start(async () => {
      const res = await updateOwnProfileAction(fd);
      setMsg(res.ok ? t('saved') : t('error'));
      if (res.ok) router.refresh();
    });
  }

  return (
    <form action={save} className="flex flex-col gap-4 rounded-lg border border-sep bg-card p-5">
      <p className="text-section font-bold text-label">{t('infoTitle')}</p>

      {/* Lecture seule — géré par le syndic */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-note font-semibold text-label-2">{t('name')}</p>
          <p className="mt-1 rounded-md bg-bg px-3 py-2 text-body text-label-3">{fullName}</p>
        </div>
        <div>
          <p className="text-note font-semibold text-label-2">{t('email')}</p>
          <p className="mt-1 truncate rounded-md bg-bg px-3 py-2 text-body text-label-3">{email ?? '—'}</p>
        </div>
      </div>
      <p className="text-note text-label-4">{t('readonlyNote')}</p>

      {/* Éditable */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field name="phone" label={t('phone')} type="tel" defaultValue={phone ?? ''} placeholder="+32 470 00 00 00" />
        <Select name="preferredLocale" label={t('language')} defaultValue={preferredLocale}>
          <option value="fr">{t('langFr')}</option>
          <option value="ar">{t('langAr')}</option>
        </Select>
        <Select name="secondaryCurrency" label={t('currency')} defaultValue={secondaryCurrency ?? ''}>
          <option value="">{t('currencyNone')}</option>
          {availableCurrencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-note text-label-4">{t('languageNote')}</p>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? t('saving') : t('save')}
        </Button>
        {msg && <span className="text-note font-semibold text-label-3">{msg}</span>}
      </div>
    </form>
  );
}
