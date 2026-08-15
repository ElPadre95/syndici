import type { ReactNode } from 'react';
import { getTranslations, getLocale } from 'next-intl/server';
import { Paperclip, MapPin, Wrench, MessageSquare, RefreshCw } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { IncidentDetail } from '@/server/incidents/data';

function statusTone(s: IncidentDetail['status']): 'success' | 'warning' | 'neutral' {
  return s === 'RESOLU' ? 'success' : s === 'EN_COURS' ? 'warning' : 'neutral';
}
function urgencyTone(u: IncidentDetail['urgency']): 'danger' | 'warning' | 'neutral' {
  return u === 'URGENTE' ? 'danger' : u === 'IMPORTANTE' ? 'warning' : 'neutral';
}

/**
 * Vue détaillée d'un incident (H1) — partagée propriétaire / syndic. En-tête (statut,
 * urgence, lieu), photo, description, la boucle de transparence (intervention + facture),
 * et le fil de suivi horodaté. Le `slot` reçoit la gestion (staff) et/ou le composeur.
 */
export async function IncidentDetailView({
  detail,
  slot,
}: {
  detail: IncidentDetail;
  slot?: ReactNode;
}) {
  const t = await getTranslations('incidents');
  const locale = await getLocale();
  const dt = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  const dtShort = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    );

  const updateLine = (u: IncidentDetail['updates'][number]): string => {
    if (u.kind === 'STATUS_CHANGE')
      return t('kindStatus', { from: t(`status${u.oldStatus}`), to: t(`status${u.newStatus}`) });
    if (u.kind === 'CONTACT') return t('kindContact', { supplier: u.message ?? '' });
    return u.message ?? '';
  };
  const UpdateIcon = { COMMENT: MessageSquare, STATUS_CHANGE: RefreshCw, CONTACT: Wrench };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={urgencyTone(detail.urgency)}>{t(`urgency${detail.urgency}`)}</Badge>
          <Badge tone={statusTone(detail.status)}>{t(`status${detail.status}`)}</Badge>
          <span className="text-note text-label-4">{t('reportedOn', { date: dt(detail.reportedAt) })}</span>
        </div>
        <h1 className="text-title text-label">{detail.category}</h1>
        <p className="flex items-center gap-1.5 text-body text-label-3">
          <MapPin className="size-4" aria-hidden />
          {detail.location} · {detail.lotReference ?? t('commonAreaLabel')}
        </p>
      </header>

      <Card className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap text-body text-label-2">{detail.description}</p>
        {detail.photoHref && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.photoHref}
            alt={t('photoAlt')}
            className="max-h-72 w-full rounded-md object-cover"
          />
        )}
      </Card>

      {/* Boucle de transparence : l'intervention et sa facture */}
      {detail.expenses.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-section font-bold text-label">{t('linkedTitle')}</h2>
          <p className="text-note text-label-4">{t('linkedNote')}</p>
          <ul className="flex flex-col gap-2">
            {detail.expenses.map((e) => (
              <li key={e.id}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-soft text-indigo">
                    <Wrench className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-label">{e.supplierName ?? e.description}</p>
                    <p className="text-note text-label-4">{dt(e.spentOn)}</p>
                  </div>
                  <span className="font-bold tabular-nums text-label-2">{formatMoney(e.amountMinor, locale)}</span>
                  {e.justificatifHref && (
                    <a
                      href={e.justificatifHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-soft px-2.5 py-1.5 text-note font-bold text-indigo hover:bg-indigo-mid"
                    >
                      <Paperclip className="size-3.5" aria-hidden />
                      {t('facture')}
                    </a>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {slot}

      {/* Fil de suivi */}
      <section className="flex flex-col gap-3">
        <h2 className="text-section font-bold text-label">{t('timeline')}</h2>
        <ol className="flex flex-col gap-3">
          {detail.updates.map((u) => {
            const Icon = UpdateIcon[u.kind];
            return (
              <li key={u.id} className="flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-bg text-label-3">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-note text-label-2">{updateLine(u)}</p>
                  <p className="text-eyebrow text-label-4">
                    {u.bySyndic ? t('bySyndic') : t('byReporter')} · {dtShort(u.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
