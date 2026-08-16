'use server';

/**
 * Dépôt d'un document (F3). Gardé par `can(role, 'document.manage')` — staff. Le fichier
 * passe par la couche de stockage C0 (`storeFile`, validation type/taille) ; l'enregistrement
 * Document ne garde qu'une référence. Le déposant est tracé sur le `FileAsset`.
 */
import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { storeFile } from '@/server/storage/files';
import { getResidenceBasics } from '@/server/residences/data';
import { requestOrigin } from '@/server/mail/links';
import { notifyResidence } from '@/server/mail/notify';
import { documentEmail } from '@/server/mail/templates';
import { normalizeLocale } from '@/server/mail/i18n';
import { createDocument } from './data';
import {
  DOCUMENT_TYPES,
  DEPOSABLE_SCOPES,
  type DocumentScope,
  type DocumentType,
} from './visibility';
import type { DocumentActionResult } from './action-types';

export async function uploadDocumentAction(formData: FormData): Promise<DocumentActionResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'document.manage')) return { ok: false, error: 'forbidden' };

  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? '') as DocumentType;
  const scope = String(formData.get('scope') ?? '') as DocumentScope;
  if (!name) return { ok: false, error: 'title_required' };
  if (!DOCUMENT_TYPES.includes(type)) return { ok: false, error: 'invalid_type' };
  if (!DEPOSABLE_SCOPES.includes(scope)) return { ok: false, error: 'invalid_scope' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'file_required' };
  const body = Buffer.from(await file.arrayBuffer());

  const stored = await storeFile(
    { residenceId: ctx.activeId },
    {
      bucket: 'documents',
      body,
      mimeType: file.type,
      originalName: file.name,
      uploadedByPersonId: ctx.personId,
    },
  );
  if (!stored.ok) return { ok: false, error: stored.error };

  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  await createDocument(actx, { fileAssetId: stored.id, name, type, scope });

  // Notification e-mail (I5) — seulement les documents visibles de TOUTE la résidence
  // (RESIDENCE) déclenchent un e-mail aux résidents. Les portées PARTAGE/PRIVE ne concernent
  // pas les autres résidents, donc aucun envoi. En dev : journalisé, jamais envoyé.
  if (scope === 'RESIDENCE') {
    const residence = await getResidenceBasics(ctx.activeId);
    const origin = await requestOrigin();
    await notifyResidence(actx, {
      audience: 'ALL',
      build: (locale) =>
        documentEmail(locale, {
          residence: residence?.name ?? '',
          title: name,
          url: `${origin}/${normalizeLocale(locale)}/proprietaire/documents`,
        }),
    });
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
