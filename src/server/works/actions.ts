'use server';

/**
 * Actions des chantiers (I7). Réservées au staff (`expense.manage`). Le fichier (devis PDF ou
 * photo) passe par la couche de stockage C0 (`storeFile`, bucket `travaux`, validation type/taille).
 * Toute écriture est tracée au journal d'audit. Le destinataire/portée est dérivé côté serveur.
 */
import { revalidatePath } from 'next/cache';
import { forResidence } from '@/server/db/tenant';
import { getSessionContext } from '@/server/session';
import { can, type AppRole } from '@/server/auth/permissions';
import { storeFile } from '@/server/storage/files';
import { parseMoneyToCentimes } from '@/server/import/normalize';
import type { UploadError } from '@/server/storage/validation';

export type WorksActionResult =
  | { ok: true; id?: string }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'no_active_residence'
        | 'invalid'
        | 'not_found'
        | UploadError;
    };

type Ctx = { personId: string; residenceId: string; role: AppRole };

async function requireWorksManager(): Promise<
  { ok: true; ctx: Ctx } | { ok: false; error: 'forbidden' | 'no_active_residence' }
> {
  const s = await getSessionContext();
  if (!s?.activeId || !s.role) return { ok: false, error: 'no_active_residence' };
  if (!can(s.role, 'expense.manage')) return { ok: false, error: 'forbidden' };
  return { ok: true, ctx: { personId: s.personId, residenceId: s.activeId, role: s.role } };
}

async function storeUpload(
  ctx: Ctx,
  file: File,
): Promise<{ ok: true; id: string } | { ok: false; error: UploadError }> {
  const stored = await storeFile(
    { residenceId: ctx.residenceId },
    {
      bucket: 'travaux',
      body: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type || 'application/octet-stream',
      originalName: file.name || null,
      uploadedByPersonId: ctx.personId,
    },
  );
  return stored;
}

/** Crée un chantier (consultation). */
export async function createWorksProjectAction(formData: FormData): Promise<WorksActionResult> {
  const g = await requireWorksManager();
  if (!g.ok) return g;
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const visibility = String(formData.get('visibility') ?? 'PARTAGE') === 'INTERNE' ? 'INTERNE' : 'PARTAGE';
  const incidentId = String(formData.get('incidentId') ?? '').trim() || null;
  if (!title || !description) return { ok: false, error: 'invalid' };

  const scoped = forResidence(g.ctx.residenceId);
  const project = await scoped.worksProject.create({
    data: { residenceId: g.ctx.residenceId, title, description, visibility, incidentId },
    select: { id: true },
  });
  await scoped.auditLog.create({
    data: {
      residenceId: g.ctx.residenceId,
      actorPersonId: g.ctx.personId,
      action: 'works.create',
      entityType: 'WorksProject',
      entityId: project.id,
      after: { title, visibility },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true, id: project.id };
}

/** Ajoute un devis à un chantier (fournisseur, montant, PDF optionnel). */
export async function addQuoteAction(formData: FormData): Promise<WorksActionResult> {
  const g = await requireWorksManager();
  if (!g.ok) return g;
  const projectId = String(formData.get('projectId') ?? '');
  const supplierName = String(formData.get('supplierName') ?? '').trim();
  const amountMinor = parseMoneyToCentimes(String(formData.get('amount') ?? ''));
  const description = String(formData.get('description') ?? '').trim() || null;
  const dateStr = String(formData.get('receivedOn') ?? '').trim();
  const receivedOn = dateStr ? new Date(dateStr) : new Date();
  if (!supplierName || amountMinor === null || amountMinor <= 0 || Number.isNaN(receivedOn.getTime())) {
    return { ok: false, error: 'invalid' };
  }

  const scoped = forResidence(g.ctx.residenceId);
  const project = await scoped.worksProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return { ok: false, error: 'not_found' };

  let fileAssetId: string | null = null;
  const file = formData.get('devis');
  if (file instanceof File && file.size > 0) {
    const up = await storeUpload(g.ctx, file);
    if (!up.ok) return { ok: false, error: up.error };
    fileAssetId = up.id;
  }

  await scoped.worksQuote.create({
    data: {
      residenceId: g.ctx.residenceId,
      projectId,
      supplierName,
      amountMinor,
      description,
      receivedOn,
      fileAssetId,
    },
  });
  await scoped.auditLog.create({
    data: {
      residenceId: g.ctx.residenceId,
      actorPersonId: g.ctx.personId,
      action: 'works.quote.add',
      entityType: 'WorksProject',
      entityId: projectId,
      after: { supplierName, amountMinor },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Retient un devis : le marque sur le chantier et fait passer le statut à « en cours ». */
export async function selectQuoteAction(formData: FormData): Promise<WorksActionResult> {
  const g = await requireWorksManager();
  if (!g.ok) return g;
  const projectId = String(formData.get('projectId') ?? '');
  const quoteId = String(formData.get('quoteId') ?? '');
  const scoped = forResidence(g.ctx.residenceId);
  // Le devis doit appartenir au chantier (jamais un id d'un autre projet/résidence).
  const quote = await scoped.worksQuote.findFirst({
    where: { id: quoteId, projectId },
    select: { id: true },
  });
  if (!quote) return { ok: false, error: 'not_found' };
  await scoped.worksProject.update({
    where: { id: projectId },
    data: { selectedQuoteId: quoteId, status: 'EN_COURS' },
  });
  await scoped.auditLog.create({
    data: {
      residenceId: g.ctx.residenceId,
      actorPersonId: g.ctx.personId,
      action: 'works.quote.select',
      entityType: 'WorksProject',
      entityId: projectId,
      after: { selectedQuoteId: quoteId },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Ajoute une photo avant/après (fichier image obligatoire). */
export async function addPhotoAction(formData: FormData): Promise<WorksActionResult> {
  const g = await requireWorksManager();
  if (!g.ok) return g;
  const projectId = String(formData.get('projectId') ?? '');
  const phase = String(formData.get('phase') ?? '') === 'APRES' ? 'APRES' : 'AVANT';
  const caption = String(formData.get('caption') ?? '').trim() || null;
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'empty' };

  const scoped = forResidence(g.ctx.residenceId);
  const project = await scoped.worksProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return { ok: false, error: 'not_found' };

  const up = await storeUpload(g.ctx, file);
  if (!up.ok) return { ok: false, error: up.error };

  await scoped.worksPhoto.create({
    data: { residenceId: g.ctx.residenceId, projectId, fileAssetId: up.id, phase, caption },
  });
  await scoped.auditLog.create({
    data: {
      residenceId: g.ctx.residenceId,
      actorPersonId: g.ctx.personId,
      action: 'works.photo.add',
      entityType: 'WorksProject',
      entityId: projectId,
      after: { phase },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Fait avancer le statut du chantier (consultation → en cours → terminé). */
export async function updateWorksStatusAction(formData: FormData): Promise<WorksActionResult> {
  const g = await requireWorksManager();
  if (!g.ok) return g;
  const projectId = String(formData.get('projectId') ?? '');
  const raw = String(formData.get('status') ?? '');
  const status =
    raw === 'CONSULTATION' || raw === 'EN_COURS' || raw === 'TERMINE' ? raw : null;
  if (!status) return { ok: false, error: 'invalid' };
  const scoped = forResidence(g.ctx.residenceId);
  const project = await scoped.worksProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return { ok: false, error: 'not_found' };
  await scoped.worksProject.update({ where: { id: projectId }, data: { status } });
  await scoped.auditLog.create({
    data: {
      residenceId: g.ctx.residenceId,
      actorPersonId: g.ctx.personId,
      action: 'works.status',
      entityType: 'WorksProject',
      entityId: projectId,
      after: { status },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
