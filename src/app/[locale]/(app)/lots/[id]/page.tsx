import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Pencil, Plane } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getLotFiche } from '@/server/lots/fiche';
import { formatMoney } from '@/lib/money';

export default async function LotFichePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('lots.fiche');
  const tType = await getTranslations('lots.type');
  const tList = await getTranslations('lots.list');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'lot.view.all')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
          {tList('noActiveBody')}
        </p>
      </div>
    );
  }

  const fiche = await getLotFiche(
    { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role },
    id,
  );
  if (!fiche) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-bg px-3 py-2 text-sm text-label-3">{tList('emptyTitle')}</p>
      </div>
    );
  }
  const { lot, owner, tenant } = fiche;

  const rows: Array<[string, string]> = [
    [t('type'), tType(lot.type)],
    [t('floor'), lot.floor ?? '—'],
    [t('surface'), lot.surfaceM2 !== null ? `${lot.surfaceM2} m²` : '—'],
    [t('quotePart'), `${lot.quotePart} / 1000`],
    [t('charge'), formatMoney(lot.monthlyChargeMinor, locale)],
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-label">Lot {lot.reference}</h1>
        <Link href={`/lots/${lot.id}/modifier`}>
          <Button variant="secondary">
            <Pencil className="size-4" aria-hidden />
            {t('edit')}
          </Button>
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-sep bg-white p-4 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-label-4">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-label">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-lg border border-sep bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-label">{t('occupants')}</h2>
        {owner || tenant ? (
          <div className="flex flex-col gap-3">
            {[
              { label: t('owner'), occ: owner },
              { label: t('tenant'), occ: tenant },
            ]
              .filter((x): x is { label: string; occ: NonNullable<typeof x.occ> } => x.occ !== null)
              .map(({ label, occ }) => (
                <div key={label} className="flex flex-col gap-1 border-s-2 border-sep ps-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-label-4">
                    {label}
                  </span>
                  <span className="text-sm font-semibold text-label">{occ.name}</span>
                  <div className="flex flex-wrap gap-2 text-xs text-label-3">
                    {occ.abroad && (
                      <span className="flex items-center gap-1 text-label-4">
                        <Plane className="size-3" aria-hidden />
                        {t('abroad', { country: occ.country ?? '' })}
                      </span>
                    )}
                    {occ.delegated && <span className="text-label-4">{t('delegated')}</span>}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm italic text-label-4">{t('none')}</p>
        )}
      </div>
    </div>
  );
}
