'use server';

/**
 * Dépôt de documents par le RÉSIDENT (H6). Le propriétaire dépose SES documents et choisit
 * la portée AU MOMENT DU DÉPÔT — « visible par mon syndic » (PARTAGE) ou « privé, visible de
 * moi seul » (PRIVE). Il peut renommer et retirer SES propres documents, jamais ceux d'un
 * autre (garde `isOwnDocument`). Le fichier passe par la couche de stockage C0 ; le déposant
 * est tracé sur le `FileAsset`, ce qui fait tenir l'étanchéité (`documentVisibleTo`).
 */
import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { forResidence } from '@/server/db/tenant';
import { storeFile } from '@/server/storage/files';
import { createDocument, isOwnDocument } from './data';
import { DOCUMENT_TYPES, type DocumentScope, type DocumentType } from './visibility';
import type { DocumentActionResult } from './action-types';

// Le résident ne choisit qu'entre partager avec le syndic ou garder privé.
const OWNER_SCOPES: readonly DocumentScope[] = ['PRIVE', 'PARTAGE'];

export async function uploadOwnDocumentAction(formData: FormData): Promise<DocumentActionResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'document.deposit.own')) return { ok: false, error: 'forbidden' };

  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? 'AUTRE') as DocumentType;
  const scope = String(formData.get('scope') ?? '') as DocumentScope;
  if (!name) return { ok: false, error: 'title_required' };
  if (!DOCUMENT_TYPES.includes(type)) return { ok: false, error: 'invalid_type' };
  if (!OWNER_SCOPES.includes(scope)) return { ok: false, error: 'invalid_scope' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'file_required' };

  const stored = await storeFile(
    { residenceId: ctx.activeId },
    {
      bucket: 'documents',
      body: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      originalName: file.name,
      uploadedByPersonId: ctx.personId, // ← fait tenir l'étanchéité PRIVE/PARTAGE
    },
  );
  if (!stored.ok) return { ok: false, error: stored.error };

  await createDocument(
    { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role },
    { fileAssetId: stored.id, name, type, scope, origin: 'RESIDENT' },
  );
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function renameOwnDocumentAction(formData: FormData): Promise<DocumentActionResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'document.deposit.own')) return { ok: false, error: 'forbidden' };
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const documentId = String(formData.get('documentId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'title_required' };
  if (!(await isOwnDocument(actx, documentId))) return { ok: false, error: 'forbidden' };

  await forResidence(ctx.activeId).document.updateMany({ where: { id: documentId }, data: { name } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function removeOwnDocumentAction(formData: FormData): Promise<DocumentActionResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'document.deposit.own')) return { ok: false, error: 'forbidden' };
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const documentId = String(formData.get('documentId') ?? '');
  if (!(await isOwnDocument(actx, documentId))) return { ok: false, error: 'forbidden' };

  const scoped = forResidence(ctx.activeId);
  const doc = await scoped.document.findUnique({
    where: { id: documentId },
    select: { fileAssetId: true },
  });
  // Retirer le document puis sa référence de fichier (FK Restrict : Document d'abord).
  await scoped.document.deleteMany({ where: { id: documentId } });
  if (doc) await scoped.fileAsset.deleteMany({ where: { id: doc.fileAssetId } });
  revalidatePath('/', 'layout');
  return { ok: true };
}
