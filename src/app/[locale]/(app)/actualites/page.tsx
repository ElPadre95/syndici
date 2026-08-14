import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, Newspaper } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listAnnouncements } from '@/server/announcements/data';
import { AnnouncementForm } from '@/components/announcements/AnnouncementForm';
import { AnnouncementList } from '@/components/announcements/AnnouncementList';

/**
 * Actualités (E3). Le staff publie (type, audience, titre, corps) et voit toute la liste.
 * Le résident les lit dans son accueil (audience filtrée). Staff : `announcement.manage`.
 */
export default async function ActualitesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('announcements');

  const ctx = await getSessionContext();
  const active = ctx?.residences.find((r) => r.id === ctx.activeId) ?? null;
  if (!ctx?.activeId || !ctx.role || !active) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
          <Building2 className="size-6" aria-hidden />
        </span>
        <p className="text-base font-bold text-label">{t('noActiveTitle')}</p>
        <p className="max-w-sm text-sm text-label-3">{t('noActiveBody')}</p>
      </div>
    );
  }
  if (!can(ctx.role, 'announcement.manage')) {
    return (
      <p className="mx-auto max-w-3xl rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
        {t('forbidden')}
      </p>
    );
  }

  const items = await listAnnouncements({
    personId: ctx.personId,
    residenceId: ctx.activeId,
    role: ctx.role,
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
        <p className="mt-1 text-sm text-label-3">{t('subtitle', { residence: active.name })}</p>
      </div>

      <AnnouncementForm />

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-label">{t('publishedTitle')}</h2>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
              <Newspaper className="size-6" aria-hidden />
            </span>
            <p className="text-base font-bold text-label">{t('emptyTitle')}</p>
            <p className="max-w-sm text-sm text-label-3">{t('emptyBody')}</p>
          </div>
        ) : (
          <AnnouncementList items={items} showAudience />
        )}
      </div>
    </div>
  );
}
