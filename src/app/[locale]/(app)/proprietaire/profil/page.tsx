import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { prismaExecutor } from '@/server/db/sql';
import { getOwnProfile } from '@/server/auth/person-access';
import { MIN_PASSWORD_LENGTH } from '@/server/auth/password';
import { listCurrencyRates } from '@/server/finance/currency';
import { OwnerProfileForm } from '@/components/app/OwnerProfileForm';
import { ChangePasswordForm } from '@/components/app/ChangePasswordForm';

/**
 * Mon profil (H7) — propriétaire. Il consulte et modifie SES informations (téléphone, langue,
 * devise secondaire) et son mot de passe. Réservé au rôle PROPRIETAIRE ; il n'édite que SA
 * fiche (person-access, self). Le nom, le lot et le rôle restent au syndic.
 */
export default async function OwnerProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('profile');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE') {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('forbidden')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const [profile, rates] = await Promise.all([
    getOwnProfile(prismaExecutor(), ctx.personId),
    listCurrencyRates(actx),
  ]);
  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-bg px-3 py-2 text-body text-label-3">{t('forbidden')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-eyebrow font-bold uppercase text-indigo">{t('eyebrow')}</p>
        <h1 className="text-title text-label">{t('pageTitle')}</h1>
      </header>

      <OwnerProfileForm
        fullName={`${profile.firstName} ${profile.lastName}`.trim()}
        email={profile.email}
        phone={profile.phone}
        preferredLocale={profile.preferredLocale}
        secondaryCurrency={profile.secondaryCurrency}
        availableCurrencies={rates.map((r) => r.currency)}
      />

      {profile.hasAccount && <ChangePasswordForm minLength={MIN_PASSWORD_LENGTH} />}
    </div>
  );
}
