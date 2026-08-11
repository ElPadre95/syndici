import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, Plus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { getSessionContext } from '@/server/session';
import { focusResidenceAction } from '@/server/residences/actions';
import { cn } from '@/lib/cn';

const MANDATE_TONE: Record<string, string> = {
  ACTIVE: 'bg-green-soft text-green',
  ENDED: 'bg-bg text-label-3',
  PENDING: 'bg-orange-soft text-orange',
  SUSPENDED: 'bg-orange-soft text-orange',
};

export default async function ResidencesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const activeLocale = await getLocale();
  const t = await getTranslations('residences.list');
  const tType = await getTranslations('vocabulaire.typeLabel');
  const tMandate = await getTranslations('residences.mandate');

  const ctx = await getSessionContext();
  const residences = ctx?.residences ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
        <Link href="/residences/nouvelle">
          <Button variant="primary">
            <Plus className="size-4" aria-hidden />
            {t('createCta')}
          </Button>
        </Link>
      </div>

      {residences.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
            <Building2 className="size-6" aria-hidden />
          </span>
          <p className="text-base font-bold text-label">{t('emptyTitle')}</p>
          <p className="max-w-sm text-sm text-label-3">{t('emptyBody')}</p>
          <Link href="/residences/nouvelle" className="mt-2">
            <Button variant="primary">{t('createCta')}</Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sep bg-white">
          <div className="grid min-w-[640px] grid-cols-[2fr_1fr_1.4fr_auto] gap-4 border-b border-sep px-4 py-2 text-xs font-bold uppercase tracking-wide text-label-4">
            <span>{t('colName')}</span>
            <span>{t('colCity')}</span>
            <span>{t('colType')}</span>
            <span className="text-end">{t('colMandate')}</span>
          </div>
          {residences.map((r) => (
            <form key={r.id} action={focusResidenceAction}>
              <input type="hidden" name="residenceId" value={r.id} />
              <input type="hidden" name="locale" value={activeLocale} />
              <button
                type="submit"
                className={cn(
                  'grid w-full min-w-[640px] grid-cols-[2fr_1fr_1.4fr_auto] items-center gap-4 border-b border-sep px-4 py-3 text-start last:border-b-0 hover:bg-bg',
                  r.id === ctx?.activeId && 'bg-indigo-soft/40',
                )}
              >
                <span className="flex flex-col">
                  <span className="font-semibold text-label">{r.name}</span>
                  <span className="text-xs text-label-4">
                    {t('lotsCount', { count: r.lotCount })}
                  </span>
                </span>
                <span className="text-sm text-label-3">{r.city ?? '—'}</span>
                <span className="text-sm text-label-3">{tType(r.type.toLowerCase())}</span>
                <span className="text-end">
                  <span
                    className={cn(
                      'inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                      r.mandateStatus ? MANDATE_TONE[r.mandateStatus] : 'bg-bg text-label-3',
                    )}
                  >
                    {r.mandateStatus ? tMandate(r.mandateStatus) : '—'}
                  </span>
                </span>
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
