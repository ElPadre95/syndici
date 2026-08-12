'use server';

/**
 * Actions serveur des rattachements (A5). Toute action passe par le point
 * d'application des autorisations (rôle sur la résidence active → `lot.manage`).
 * Les identités passent par person-access ; la création et le rattachement sont
 * historisés, jamais écrasés.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { routing } from '@/i18n/routing';
import { getSessionContext } from '@/server/session';
import { prismaExecutor } from '@/server/db/sql';
import { can } from '@/server/auth/permissions';
import { listAccessibleResidences } from '@/server/auth/context';
import { searchPersons } from '@/server/auth/person-access';
import type { ActiveContext } from '@/server/auth/context';
import { attachPerson, endAttachment } from './attachments';
import { validateAttachInput, type AttachFormState } from './attach-validation';

function localePath(raw: FormDataEntryValue | null): string {
  const value = typeof raw === 'string' ? raw : '';
  return (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

type Manager = { ctx: ActiveContext } | { error: 'no_active_residence' | 'forbidden' };

async function requireManager(): Promise<Manager> {
  const s = await getSessionContext();
  if (!s?.activeId || !s.role) return { error: 'no_active_residence' };
  if (!can(s.role, 'lot.manage')) return { error: 'forbidden' };
  return { ctx: { personId: s.personId, residenceId: s.activeId, role: s.role } };
}

export interface PersonCandidate {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
}

/** Recherche de personnes déjà connues (dédoublonnage MRE) — staff uniquement. */
export async function searchPersonsAction(query: string): Promise<PersonCandidate[]> {
  const mgr = await requireManager();
  if ('error' in mgr) return [];
  const exec = prismaExecutor();
  const residenceIds = await listAccessibleResidences(exec, mgr.ctx.personId);
  const found = await searchPersons(exec, mgr.ctx, query, residenceIds);
  return found.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`.trim(),
    email: p.email,
    country: p.nationality,
  }));
}

export async function addPersonAction(
  _prev: AttachFormState,
  formData: FormData,
): Promise<AttachFormState> {
  const mgr = await requireManager();
  if ('error' in mgr) return { formError: mgr.error };
  const { ctx } = mgr;

  const lotId = String(formData.get('lotId') ?? '');
  if (!lotId) return { formError: 'not_found' };

  const parsed = validateAttachInput({
    existingPersonId: String(formData.get('existingPersonId') ?? ''),
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    nationality: String(formData.get('nationality') ?? ''),
    preferredLocale: String(formData.get('preferredLocale') ?? ''),
    role: String(formData.get('role') ?? ''),
    delegate: String(formData.get('delegate') ?? ''),
    startDate: String(formData.get('startDate') ?? ''),
  });
  if (!parsed.ok) return { errors: parsed.errors };
  const draft = parsed.value;

  const isChargePayer = draft.role === 'OWNER' ? true : draft.delegate;
  // Création (si nouvelle personne) + rattachement dans une seule transaction :
  // un chevauchement ne laisse aucune personne orpheline.
  const result = await attachPerson(ctx, {
    lotId,
    personId: draft.existingPersonId ?? undefined,
    newPerson: draft.person ?? undefined,
    role: draft.role,
    isChargePayer,
    startDate: draft.startDate,
  });
  if (!result.ok) return { formError: result.reason };

  revalidatePath('/', 'layout');
  redirect(`/${localePath(formData.get('locale'))}/lots/${lotId}`);
}

export async function endAttachmentAction(formData: FormData): Promise<void> {
  const mgr = await requireManager();
  if ('error' in mgr) return;
  const attachmentId = String(formData.get('attachmentId') ?? '');
  const lotId = String(formData.get('lotId') ?? '');
  const endTrim = String(formData.get('endDate') ?? '').trim();
  const endDate = new Date(endTrim);
  if (!attachmentId || endTrim === '' || Number.isNaN(endDate.getTime())) return;

  await endAttachment(mgr.ctx, attachmentId, endDate);
  revalidatePath('/', 'layout');
  redirect(`/${localePath(formData.get('locale'))}/lots/${lotId}`);
}
