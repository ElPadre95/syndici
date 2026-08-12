import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getLot } from '@/server/lots/data';
import { AddPersonForm } from '@/components/lots/AddPersonForm';

export default async function AddPersonPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('lots.attach');
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
  const lot = await getLot(ctx.activeId, id);
  if (!lot) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-bg px-3 py-2 text-sm text-label-3">{t('errors.not_found')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-extrabold text-label">
        {t('title')} · {lot.reference}
      </h1>
      <AddPersonForm lotId={lot.id} lotReference={lot.reference} />
    </div>
  );
}
