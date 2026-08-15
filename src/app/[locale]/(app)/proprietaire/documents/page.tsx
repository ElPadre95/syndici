import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { signedFilePath } from '@/server/storage/sign';
import { listOwnDocuments } from '@/server/documents/data';
import { OwnerDocumentDeposit } from '@/components/documents/OwnerDocumentDeposit';
import { OwnerDocumentRow } from '@/components/documents/OwnerDocumentRow';

/**
 * Mes documents (H6) — propriétaire. Déposer un document en choisissant sa portée au dépôt
 * (« visible par mon syndic » ou « privé, visible de moi seul »), consulter, renommer et
 * retirer les SIENS. Réservé au rôle PROPRIETAIRE (`document.deposit.own`) ; il ne voit et
 * ne gère que ses propres dépôts. Un document privé n'est jamais servi à un autre (mur).
 */
export default async function OwnerDocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ownerDocs');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'document.deposit.own')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('forbidden')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const docs = await listOwnDocuments(actx);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-eyebrow font-bold uppercase text-indigo">{t('eyebrow')}</p>
        <h1 className="text-title text-label">{t('pageTitle')}</h1>
        <p className="mt-1 text-body text-label-3">{t('subtitle')}</p>
      </header>

      <OwnerDocumentDeposit />

      <section className="flex flex-col gap-3">
        <h2 className="text-section font-bold text-label">{t('listTitle')}</h2>
        {docs.length === 0 ? (
          <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {docs.map((d) => (
              <OwnerDocumentRow
                key={d.id}
                id={d.id}
                name={d.name}
                scope={d.scope}
                typeLabel={t(`docType.${d.type}`)}
                href={signedFilePath(d.fileAssetId, 3600)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
