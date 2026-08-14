import { getTranslations } from 'next-intl/server';
import { Home, Clock, Newspaper } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { AnnouncementList } from '@/components/announcements/AnnouncementList';
import type { ResidentAttachment } from '@/server/residents/home';
import type { AnnouncementView } from '@/server/announcements/data';

/**
 * Accueil d'un résident (propriétaire/locataire invité) — A7 §1 + E3. Informatif : son
 * nom, ses rattachements, et les ACTUALITÉS qui le concernent (audience filtrée). Aucune
 * fonction de gestion. Son espace complet arrive.
 */
export async function ResidentHome({
  name,
  attachments,
  announcements,
}: {
  name: string | null;
  attachments: ResidentAttachment[];
  announcements: AnnouncementView[];
}) {
  const t = await getTranslations('app.residentHome');

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo">
          {t('sectionLabel')}
        </p>
        <h1 className="text-3xl font-extrabold text-label">
          {name ? t('welcome', { name }) : t('welcomeGeneric')}
        </h1>
      </header>

      <Card>
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-indigo-soft text-indigo">
            <Home className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-label">{t('attachmentsTitle')}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {attachments.map((a, i) => (
                <li
                  key={`${a.residence}-${a.lot}-${i}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-bg px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-label">{a.residence}</span>
                  <span className="text-label-4" aria-hidden>
                    ·
                  </span>
                  <span className="text-label-3">{t('lot', { lot: a.lot })}</span>
                  <span className="ms-auto rounded-full bg-indigo-soft px-2 py-0.5 text-xs font-bold text-indigo">
                    {t(a.role === 'OWNER' ? 'roleOwner' : 'roleTenant')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Actualités concernant le résident (E3) — audience déjà filtrée côté données. */}
      {announcements.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-label">
            <Newspaper className="size-4 text-indigo" aria-hidden />
            {t('newsTitle')}
          </h2>
          <AnnouncementList items={announcements} />
        </section>
      )}

      <div className="flex items-center gap-2 text-sm text-label-3">
        <Clock className="size-4 text-label-4" aria-hidden />
        <span>{t('spaceComing')}</span>
      </div>
    </div>
  );
}
