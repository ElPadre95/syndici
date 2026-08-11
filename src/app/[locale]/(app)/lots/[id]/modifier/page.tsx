import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getLot, lotHasHistory } from '@/server/lots/data';
import { LotForm } from '@/components/lots/LotForm';
import { DeleteLotButton } from '@/components/lots/DeleteLotButton';

export default async function EditLotPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
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

  const lot = await getLot(ctx.activeId, id);
  if (!lot) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-bg px-3 py-2 text-sm text-label-3">{t('errors.not_found')}</p>
      </div>
    );
  }
  const hasHistory = await lotHasHistory(ctx.activeId, id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-label">
          {t('editTitle')} · {lot.reference}
        </h1>
      </div>
      <LotForm initial={lot} />
      <div className="border-t border-sep pt-4">
        <p className="mb-1 text-sm font-bold text-label">{t('dangerTitle')}</p>
        <p className="mb-3 text-xs text-label-4">{t('dangerHint')}</p>
        <DeleteLotButton lotId={lot.id} hasHistory={hasHistory} />
      </div>
    </div>
  );
}
