import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { forResidence } from '@/server/db/tenant';
import { getFormalNotice } from '@/server/finance/formal-notice';
import { FormalNoticeDocument } from '@/components/finance/FormalNoticeDocument';
import { FormalNoticeActions } from '@/components/finance/FormalNoticeActions';
import { formatMoney } from '@/lib/money';
import { Link } from '@/i18n/navigation';

/**
 * Mise en demeure (I4) — lettre formelle imprimable pour un lot dont le retard a franchi le
 * seuil configuré. Réservé au staff (`reminder.manage`). L'émission (canal COURRIER) est tracée.
 */
export default async function MiseEnDemeurePage({
  params,
}: {
  params: Promise<{ locale: string; lotId: string }>;
}) {
  const { locale, lotId } = await params;
  setRequestLocale(locale);
  const localeC = await getLocale();
  const t = await getTranslations('miseEnDemeure');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'reminder.manage')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('forbidden')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const notice = await getFormalNotice(actx, lotId);

  const back = (
    <Link
      href="/relances"
      data-print-hide
      className="inline-flex items-center gap-1 text-note font-semibold text-label-3 hover:text-label"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t('back')}
    </Link>
  );

  if (!notice) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {back}
        <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">
          {t('notFound')}
        </p>
      </div>
    );
  }
  if (!notice.eligible) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {back}
        <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-3">
          {t('notEligible', { lot: notice.lotReference })}
        </p>
      </div>
    );
  }

  const dateLabel = new Intl.DateTimeFormat(localeC, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const periods = notice.periods
    .map((p) =>
      new Intl.DateTimeFormat(localeC, { month: 'long', year: 'numeric' }).format(
        new Date(p.year, p.month - 1, 1),
      ),
    )
    .join(localeC === 'ar' ? '، ' : ', ');

  const body = t('body', {
    name: notice.recipientName ?? '—',
    lot: notice.lotReference,
    residence: notice.residence.name,
    amount: formatMoney(notice.amountDueMinor, localeC),
    periods,
    days: notice.retardDays,
    deadline: notice.deadlineDays,
  });

  // Un lot déjà mis en demeure : on l'indique (la lettre reste réimprimable).
  const alreadySent =
    (await forResidence(actx.residenceId).reminder.count({
      where: { lotId, kind: 'MISE_EN_DEMEURE' },
    })) > 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {back}
      <FormalNoticeActions lotId={lotId} letterText={body} alreadySent={alreadySent} />
      <FormalNoticeDocument
        residence={notice.residence}
        lotReference={notice.lotReference}
        recipientName={notice.recipientName}
        dateLabel={dateLabel}
        title={t('docTitle')}
        toLabel={t('to')}
        subjectLabel={t('subject')}
        lotLabel={t('lot')}
        body={body}
        signatureLabel={t('signature')}
      />
    </div>
  );
}
