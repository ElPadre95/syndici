import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DoorOpen, Plus, Sparkles, AlertTriangle, Building2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { getSessionContext } from '@/server/session';
import { listLots, quotePartTotal } from '@/server/lots/data';
import { QUOTE_PART_TARGET } from '@/server/lots/validation';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';

export default async function LotsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('lots.list');
  const tType = await getTranslations('lots.type');

  const ctx = await getSessionContext();
  const active = ctx?.residences.find((r) => r.id === ctx.activeId) ?? null;

  if (!ctx?.activeId || !active) {
    return (
      <EmptyState
        icon={<Building2 className="size-6" aria-hidden />}
        title={t('noActiveTitle')}
        body={t('noActiveBody')}
      />
    );
  }

  const lots = await listLots(ctx.activeId);
  const total = await quotePartTotal(ctx.activeId);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
          <p className="mt-1 text-sm text-label-3">
            {t('subtitle', { residence: active.name, count: lots.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/lots/generer">
            <Button variant="secondary">
              <Sparkles className="size-4" aria-hidden />
              {t('generateCta')}
            </Button>
          </Link>
          <Link href="/lots/nouveau">
            <Button variant="primary">
              <Plus className="size-4" aria-hidden />
              {t('addCta')}
            </Button>
          </Link>
        </div>
      </div>

      {lots.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="size-6" aria-hidden />}
          title={t('emptyTitle')}
          body={t('emptyBody')}
          action={
            <Link href="/lots/generer" className="mt-2">
              <Button variant="primary">{t('generateCta')}</Button>
            </Link>
          }
        />
      ) : (
        <>
          {total !== QUOTE_PART_TARGET && (
            <p className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {t('quotePartWarning', { total })}
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-sep bg-white">
            <div className="grid min-w-[640px] grid-cols-[70px_1fr_80px_90px_90px_120px] gap-3 border-b border-sep px-4 py-2 text-xs font-bold uppercase tracking-wide text-label-4">
              <span>{t('colRef')}</span>
              <span>{t('colType')}</span>
              <span>{t('colFloor')}</span>
              <span className="text-end">{t('colSurface')}</span>
              <span className="text-end">{t('colQuote')}</span>
              <span className="text-end">{t('colCharge')}</span>
            </div>
            {lots.map((lot) => (
              <Link
                key={lot.id}
                href={`/lots/${lot.id}`}
                className="grid min-w-[640px] grid-cols-[70px_1fr_80px_90px_90px_120px] items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0 hover:bg-bg"
              >
                <span className="rounded-md bg-bg py-1 text-center text-sm font-extrabold tracking-wide">
                  {lot.reference}
                </span>
                <span className="text-sm text-label">{tType(lot.type)}</span>
                <span className="text-sm text-label-3">{lot.floor ?? '—'}</span>
                <span className="text-end text-sm text-label-3">
                  {lot.surfaceM2 !== null ? `${lot.surfaceM2} m²` : '—'}
                </span>
                <span className="text-end text-sm tabular-nums text-label-3">{lot.quotePart}</span>
                <span className="text-end text-sm font-semibold tabular-nums text-label">
                  {formatMoney(lot.monthlyChargeMinor, locale)}
                </span>
              </Link>
            ))}
          </div>

          <p
            className={cn('text-sm', total === QUOTE_PART_TARGET ? 'text-label-3' : 'text-orange')}
          >
            {t('quotePartTotal', { total })}
          </p>
        </>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
          {icon}
        </span>
        <p className="text-base font-bold text-label">{title}</p>
        <p className="max-w-sm text-sm text-label-3">{body}</p>
        {action}
      </div>
    </div>
  );
}
