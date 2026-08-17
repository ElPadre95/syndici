import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Inbox, CheckCircle2 } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { listContactRequests } from '@/server/contact/data';
import { HandleButton } from '@/components/contact/HandleButton';

/**
 * Écran staff — les demandes de contact reçues depuis la vitrine (J1). Consultation des leads
 * persistés (non traités et récents d'abord). Réservé au STAFF (mandat actif) : ce sont des
 * prospects, pas une donnée de copropriété. Chaque demande se marque traitée / se rouvre.
 */
export default async function DemandesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const activeLocale = await getLocale();
  const t = await getTranslations('demandes');

  const ctx = await getSessionContext();
  if (!ctx?.isStaff) {
    return (
      <p className="mx-auto max-w-3xl rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
        {t('forbidden')}
      </p>
    );
  }

  const requests = await listContactRequests();
  const pending = requests.filter((r) => !r.handled).length;
  const fmtDate = new Intl.DateTimeFormat(activeLocale, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
        {requests.length > 0 && (
          <span className="text-sm font-semibold text-label-3">
            {pending > 0 ? t('pending', { count: pending }) : t('allHandled')}
          </span>
        )}
      </div>
      <p className="max-w-2xl text-sm text-label-3">{t('subtitle')}</p>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
            <Inbox className="size-6" aria-hidden />
          </span>
          <p className="text-base font-bold text-label">{t('empty')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-sep bg-white p-5"
              style={r.handled ? { opacity: 0.7 } : undefined}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-label">{r.name}</span>
                    <span className="rounded-full bg-indigo-soft px-2 py-0.5 text-note font-semibold text-indigo">
                      {t(`role${r.role}`)}
                    </span>
                    {r.handled && (
                      <span className="inline-flex items-center gap-1 text-note font-semibold text-green">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        {t('handled')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-label-3">
                    <a href={`mailto:${r.email}`} className="hover:underline">
                      {r.email}
                    </a>
                    {r.phone && <span>· {r.phone}</span>}
                    {r.city && <span>· {r.city}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-note text-label-4">
                    {t('received')} {fmtDate.format(new Date(r.createdAt))}
                  </span>
                  <HandleButton id={r.id} handled={r.handled} />
                </div>
              </div>

              {(r.residences != null || r.lots != null) && (
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-label-2">
                  {r.residences != null && (
                    <span>
                      <span className="text-label-4">{t('residences')} : </span>
                      <span className="font-semibold">{r.residences}</span>
                    </span>
                  )}
                  {r.lots != null && (
                    <span>
                      <span className="text-label-4">{t('lots')} : </span>
                      <span className="font-semibold">{r.lots}</span>
                    </span>
                  )}
                </div>
              )}

              {r.message && (
                <p className="mt-3 whitespace-pre-line rounded-md bg-bg px-3 py-2 text-sm text-label-2">
                  {r.message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
