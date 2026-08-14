import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { getResidenceBasics } from '@/server/residences/data';
import { can } from '@/server/auth/permissions';
import { GenerationForm } from '@/components/lots/GenerationForm';

export default async function GenerateLotsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('lots.generate');
  const tList = await getTranslations('lots.list');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'lot.manage')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
          {ctx?.activeId ? t('errors.forbidden') : tList('noActiveBody')}
        </p>
      </div>
    );
  }
  const basics = await getResidenceBasics(ctx.activeId);
  if (!basics) {
    // Résidence active introuvable (supprimée en cours de session) : message explicite,
    // jamais une page blanche.
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
          {tList('noActiveBody')}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
        <p className="mt-1 text-sm text-label-3">{basics.name}</p>
      </div>
      <GenerationForm residenceType={basics.type} defaultUnitsCount={basics.defaultUnitsCount} />
    </div>
  );
}
