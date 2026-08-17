import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getWorksProject } from '@/server/works/data';
import { WorksDetailPanel } from '@/components/works/WorksDetailPanel';
import { Badge } from '@/components/ui/Badge';
import { Link } from '@/i18n/navigation';

const STATUS_TONE = {
  CONSULTATION: 'neutral',
  EN_COURS: 'warning',
  TERMINE: 'success',
} as const;

/** Détail d'un chantier (I7) — devis comparatifs + photos avant/après. Staff (`expense.manage`). */
export default async function WorksProjectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const localeC = await getLocale();
  const t = await getTranslations('travaux');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'expense.manage')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('forbidden')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const detail = await getWorksProject(actx, id, true);
  if (!detail) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <Link href="/travaux" className="text-note font-semibold text-label-3 hover:text-label">
          {t('back')}
        </Link>
        <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">
          {t('notFound')}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link
          href="/travaux"
          className="inline-flex items-center gap-1 text-note font-semibold text-label-3 hover:text-label"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('back')}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-title text-label">{detail.title}</h1>
          <Badge tone={STATUS_TONE[detail.status]}>{t(`status.${detail.status}`)}</Badge>
          {detail.visibility === 'INTERNE' && (
            <Badge tone="neutral">{t('visibilityInternal')}</Badge>
          )}
        </div>
        <p className="mt-1 whitespace-pre-line text-body text-label-2">{detail.description}</p>
      </div>

      <WorksDetailPanel detail={detail} locale={localeC} />
    </div>
  );
}
