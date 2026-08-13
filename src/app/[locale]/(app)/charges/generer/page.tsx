import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { CampaignWizard } from '@/components/finance/CampaignWizard';

/**
 * Génération d'une campagne d'appels de charges (B1). Réservé au staff porteur de
 * `charge.manage` ; sinon retour à l'accueil (pas de fuite).
 */
export default async function GenerateCampaignPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('charges.generate');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'charge.manage')) {
    redirect(`/${locale}`);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
        <p className="mt-2 text-sm text-label-3">{t('subtitle')}</p>
      </header>
      <CampaignWizard />
    </div>
  );
}
