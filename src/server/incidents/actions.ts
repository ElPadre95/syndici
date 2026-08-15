'use server';

/**
 * Actions incidents (H1). Signalement (tout rôle connecté — `incident.report`), et gestion
 * réservée au staff (`incident.manage`) : commentaire, changement de statut, affectation à
 * un fournisseur, et lien vers la dépense qui en découle (boucle de transparence). Chaque
 * écriture significative est tracée au journal d'audit. La photo passe par la couche de
 * stockage existante (bucket « incidents ») ; son service est re-gardé au niveau de l'incident.
 */
import { revalidatePath } from 'next/cache';
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { storeFile } from '@/server/storage/files';
import type { ActiveContext } from '@/server/auth/context';
import { canAccessIncident } from './access';

const URGENCIES = ['NORMALE', 'IMPORTANTE', 'URGENTE'] as const;
const STATUSES = ['NOUVEAU', 'EN_COURS', 'RESOLU'] as const;
type Urgency = (typeof URGENCIES)[number];
type Status = (typeof STATUSES)[number];

async function activeCtx(): Promise<ActiveContext | null> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return null;
  return { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
}

export type IncidentActionResult =
  | { ok: true; id: string }
  | { ok: false; error: 'unauthenticated' | 'forbidden' | 'invalid' | 'not_found' | 'attachment' };

/** Signaler un incident. Si un lot est visé, le déclarant doit y être rattaché (son lot). */
export async function reportIncidentAction(formData: FormData): Promise<IncidentActionResult> {
  const ctx = await activeCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };
  if (!can(ctx.role, 'incident.report')) return { ok: false, error: 'forbidden' };

  const category = String(formData.get('category') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const location = String(formData.get('location') ?? '').trim();
  const urgency = String(formData.get('urgency') ?? 'NORMALE') as Urgency;
  const lotId = String(formData.get('lotId') ?? '').trim() || null;
  if (!category || !description || !location || !URGENCIES.includes(urgency)) {
    return { ok: false, error: 'invalid' };
  }

  const scoped = forResidence(ctx.residenceId);
  if (lotId) {
    // Lot visé → le déclarant doit y être rattaché (jamais le lot d'un autre).
    const link = await scoped.lotAttachment.findFirst({
      where: { lotId, personId: ctx.personId, endDate: null },
      select: { id: true },
    });
    if (!link) return { ok: false, error: 'forbidden' };
  }

  const photo = formData.get('photo');
  let photoId: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    const stored = await storeFile(
      { residenceId: ctx.residenceId },
      {
        bucket: 'incidents',
        body: Buffer.from(await photo.arrayBuffer()),
        mimeType: photo.type || 'application/octet-stream',
        originalName: photo.name || null,
        uploadedByPersonId: ctx.personId,
      },
    );
    if (!stored.ok) return { ok: false, error: 'attachment' };
    photoId = stored.id;
  }

  const inc = await scoped.incident.create({
    data: {
      residenceId: ctx.residenceId,
      lotId,
      reportedByPersonId: ctx.personId,
      category,
      location,
      description,
      urgency,
      status: 'NOUVEAU',
      photoId,
    },
    select: { id: true },
  });
  await scoped.auditLog.create({
    data: {
      residenceId: ctx.residenceId,
      actorPersonId: ctx.personId,
      action: 'incident.report',
      entityType: 'Incident',
      entityId: inc.id,
      after: { category, urgency, lotId },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true, id: inc.id };
}

/** Ajouter un commentaire au fil : le déclarant OU le staff, si l'incident est accessible. */
export async function addIncidentCommentAction(formData: FormData): Promise<IncidentActionResult> {
  const ctx = await activeCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };
  const incidentId = String(formData.get('incidentId') ?? '');
  const message = String(formData.get('message') ?? '').trim();
  if (!message) return { ok: false, error: 'invalid' };
  if (!(await canAccessIncident(prismaExecutor(), ctx, incidentId))) {
    return { ok: false, error: 'forbidden' };
  }
  await forResidence(ctx.residenceId).incidentUpdate.create({
    data: {
      residenceId: ctx.residenceId,
      incidentId,
      authorPersonId: ctx.personId,
      kind: 'COMMENT',
      message,
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true, id: incidentId };
}

/** Changer le statut (staff) : trace un STATUS_CHANGE dans le fil + met à jour resolvedAt. */
export async function changeIncidentStatusAction(
  formData: FormData,
): Promise<IncidentActionResult> {
  const ctx = await activeCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };
  if (!can(ctx.role, 'incident.manage')) return { ok: false, error: 'forbidden' };
  const incidentId = String(formData.get('incidentId') ?? '');
  const newStatus = String(formData.get('status') ?? '') as Status;
  if (!STATUSES.includes(newStatus)) return { ok: false, error: 'invalid' };
  const meta = await canAccessIncident(prismaExecutor(), ctx, incidentId);
  if (!meta) return { ok: false, error: 'not_found' };

  const scoped = forResidence(ctx.residenceId);
  const current = await scoped.incident.findUnique({
    where: { id: incidentId },
    select: { status: true },
  });
  if (!current || current.status === newStatus) return { ok: false, error: 'invalid' };

  await scoped.incident.update({
    where: { id: incidentId },
    data: { status: newStatus, resolvedAt: newStatus === 'RESOLU' ? new Date() : null },
  });
  await scoped.incidentUpdate.create({
    data: {
      residenceId: ctx.residenceId,
      incidentId,
      authorPersonId: ctx.personId,
      kind: 'STATUS_CHANGE',
      oldStatus: current.status,
      newStatus,
    },
  });
  await scoped.auditLog.create({
    data: {
      residenceId: ctx.residenceId,
      actorPersonId: ctx.personId,
      action: 'incident.status',
      entityType: 'Incident',
      entityId: incidentId,
      after: { from: current.status, to: newStatus },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true, id: incidentId };
}

/** Affecter à un fournisseur (staff) : trace un CONTACT dans le fil. */
export async function assignSupplierAction(formData: FormData): Promise<IncidentActionResult> {
  const ctx = await activeCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };
  if (!can(ctx.role, 'incident.manage')) return { ok: false, error: 'forbidden' };
  const incidentId = String(formData.get('incidentId') ?? '');
  const supplier = String(formData.get('supplier') ?? '').trim();
  if (!supplier) return { ok: false, error: 'invalid' };
  if (!(await canAccessIncident(prismaExecutor(), ctx, incidentId))) {
    return { ok: false, error: 'not_found' };
  }
  await forResidence(ctx.residenceId).incidentUpdate.create({
    data: {
      residenceId: ctx.residenceId,
      incidentId,
      authorPersonId: ctx.personId,
      kind: 'CONTACT',
      message: supplier,
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true, id: incidentId };
}

/** Relier une dépense existante à l'incident (staff) : ferme la boucle de transparence. */
export async function linkExpenseToIncidentAction(
  formData: FormData,
): Promise<IncidentActionResult> {
  const ctx = await activeCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };
  if (!can(ctx.role, 'expense.manage')) return { ok: false, error: 'forbidden' };
  const incidentId = String(formData.get('incidentId') ?? '');
  const expenseId = String(formData.get('expenseId') ?? '');
  if (!expenseId) return { ok: false, error: 'invalid' };
  const meta = await canAccessIncident(prismaExecutor(), ctx, incidentId);
  if (!meta) return { ok: false, error: 'not_found' };

  const scoped = forResidence(ctx.residenceId);
  // `updateMany` (scopé résidence) : l'id de dépense doit appartenir à la résidence active.
  const res = await scoped.expense.updateMany({
    where: { id: expenseId },
    data: { incidentId },
  });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  await scoped.auditLog.create({
    data: {
      residenceId: ctx.residenceId,
      actorPersonId: ctx.personId,
      action: 'incident.expense.link',
      entityType: 'Expense',
      entityId: expenseId,
      after: { incidentId },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true, id: incidentId };
}
