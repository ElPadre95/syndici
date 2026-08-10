import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, ArrowRight } from 'lucide-react';
import { auth } from '@/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';

/**
 * Page d'accueil de l'espace syndic (A1). Salue l'utilisateur connecté (ou
 * l'invite à se connecter) et propose le premier pas : créer une résidence.
 */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('app.dashboard');
  const session = await auth();
  const name = session?.user?.name ?? session?.user?.email ?? null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo">
          {t('sectionLabel')}
        </p>
        <h1 className="text-3xl font-extrabold text-label">
          {name ? t('welcome', { name }) : t('welcomeGuest')}
        </h1>
        {!name && <p className="mt-2 text-sm text-label-3">{t('subtitleGuest')}</p>}
      </header>

      <Card>
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-indigo-soft text-indigo">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-label">{t('getStartedTitle')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-label-3">{t('getStartedBody')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/residences">
                <Button variant="primary">
                  {t('createResidence')}
                  <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </Button>
              </Link>
              <Link href="/residences">
                <Button variant="secondary">{t('viewResidences')}</Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
