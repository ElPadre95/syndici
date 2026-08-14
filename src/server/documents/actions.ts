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

  await createDocument(
    { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role },
    { fileAssetId: stored.id, name, type, scope },
  );
  revalidatePath('/', 'layout');
  return { ok: true };
}
