import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listVisibleDocuments } from '@/server/documents/data';
import { signedFilePath } from '@/server/storage/sign';
import { DocumentsManager, type DocumentRow } from '@/components/documents/DocumentsManager';

/**
 * Documents (F3). Dépôt (staff) titre/type/portée, liste filtrable, consultation via la
 * route signée C0. Les documents « de toute la résidence » apparaissent aussi chez le
 * résident (accueil). L'étanchéité (privé/partagé/résidence) est appliquée côté données.
 */
export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('documents.f3');

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

  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const documents = await listVisibleDocuments(actx);
  const canManage = can(ctx.role, 'document.manage');

  // Lien signé et expirant vers chaque fichier (route de service C0), TTL confortable
  // pour la durée d'une session de consultation.
  const rows: DocumentRow[] = documents.map((d) => ({
    ...d,
    href: signedFilePath(d.fileAssetId, 3600),
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
        <p className="mt-1 text-sm text-label-3">{t('subtitle', { residence: active.name })}</p>
      </div>
      <DocumentsManager rows={rows} canManage={canManage} />
    </div>
  );
}
