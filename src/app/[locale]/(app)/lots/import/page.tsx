import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { ImportWizard } from '@/components/lots/ImportWizard';

/**
 * Écran d'import de lots (A7). Réservé au staff : `can(role, 'lot.manage')`. La
 * résidence active vient du serveur ; sans droit, retour à l'accueil (pas de fuite).
 */
export default async function ImportLotsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('lots.import');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'lot.manage')) {
    redirect(`/${locale}`);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
        <p className="mt-2 text-sm text-label-3">{t('subtitle')}</p>
      </header>
      <ImportWizard />
    </div>
  );
}
