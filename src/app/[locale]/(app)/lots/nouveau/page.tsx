import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { LotForm } from '@/components/lots/LotForm';

export default async function NewLotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('lots.form');
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
      <LotForm />
    </div>
  );
}
