'use server';

/**
 * Actions serveur des lots (A3). TOUTE action passe par le point d'application des
 * autorisations : contexte de session → rôle sur la résidence active →
 * `can(role, 'lot.manage' | 'lot.delete')`. La résidence active vient du serveur,
 * jamais d'un identifiant fourni par le client.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { routing } from '@/i18n/routing';
import { getSessionContext } from '@/server/session';
import { can, type AppRole } from '@/server/auth/permissions';
import {
  validateGenerationInput,
  validateLotInput,
  type GroupRaw,
  type LotFormRaw,
  type LotFormState,
} from './validation';
import {
  archiveLot,
  createLot,
  deleteLot,
  generateLots,
  getLot,
  LotConflictError,
  lotHasHistory,
  previewGeneration,
  updateLot,
  type GenerationResult,
} from './data';
import type { GenerationPreview } from './generation';

function localePath(raw: FormDataEntryValue | null | string): string {
  const value = typeof raw === 'string' ? raw : '';
  return (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

type Manager =
  { residenceId: string; role: AppRole } | { error: 'no_active_residence' | 'forbidden' };

async function requireManager(): Promise<Manager> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { error: 'no_active_residence' };
  if (!can(ctx.role, 'lot.manage')) return { error: 'forbidden' };
  return { residenceId: ctx.activeId, role: ctx.role };
}

// ── Génération en série ─────────────────────────────────────────────────────

export type PreviewState = { ok: true; preview: GenerationPreview } | { ok: false; error: string };

export async function previewGenerationAction(rawGroups: GroupRaw[]): Promise<PreviewState> {
  const mgr = await requireManager();
  if ('error' in mgr) return { ok: false, error: mgr.error };
  const parsed = validateGenerationInput(rawGroups);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, preview: await previewGeneration(mgr.residenceId, parsed.groups) };
}

export type GenerateState = { ok: true; result: GenerationResult } | { ok: false; error: string };

export async function generateLotsAction(rawGroups: GroupRaw[]): Promise<GenerateState> {
  const mgr = await requireManager();
  if ('error' in mgr) return { ok: false, error: mgr.error };
  const parsed = validateGenerationInput(rawGroups);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const result = await generateLots(mgr.residenceId, parsed.groups);
  revalidatePath('/', 'layout');
  return { ok: true, result };
}

// ── Création / modification unitaire ────────────────────────────────────────

export async function createLotAction(
  _prev: LotFormState,
  formData: FormData,
): Promise<LotFormState> {
  const mgr = await requireManager();
  if ('error' in mgr) return { formError: mgr.error };
  const parsed = validateLotInput(readLotForm(formData));
  if (!parsed.ok) return { errors: parsed.errors };
  try {
    await createLot(mgr.residenceId, parsed.value);
  } catch (e) {
    if (e instanceof LotConflictError) return { errors: { reference: 'conflict' } };
    return { formError: 'server' };
  }
  revalidatePath('/', 'layout');
  redirect(`/${localePath(formData.get('locale'))}/lots`);
}

export async function updateLotAction(
  _prev: LotFormState,
  formData: FormData,
): Promise<LotFormState> {
  const mgr = await requireManager();
  if ('error' in mgr) return { formError: mgr.error };
  const lotId = String(formData.get('lotId') ?? '');
  if (!lotId || !(await getLot(mgr.residenceId, lotId))) return { formError: 'not_found' };
  const parsed = validateLotInput(readLotForm(formData));
  if (!parsed.ok) return { errors: parsed.errors };
  try {
    await updateLot(mgr.residenceId, lotId, parsed.value);
  } catch (e) {
    if (e instanceof LotConflictError) return { errors: { reference: 'conflict' } };
    return { formError: 'server' };
  }
  revalidatePath('/', 'layout');
  redirect(`/${localePath(formData.get('locale'))}/lots`);
}

// ── Suppression / archivage ─────────────────────────────────────────────────

export async function deleteLotAction(formData: FormData): Promise<void> {
  const mgr = await requireManager();
  if ('error' in mgr) return;
  const lotId = String(formData.get('lotId') ?? '');
  if (!lotId || !(await getLot(mgr.residenceId, lotId))) return;

  if (await lotHasHistory(mgr.residenceId, lotId)) {
    // Historique présent → archivage (jamais d'effacement). Suffit du droit lot.manage.
    await archiveLot(mgr.residenceId, lotId);
  } else {
    // Lot vierge → suppression physique, réservée au droit lot.delete (SYNDIC).
    if (!can(mgr.role, 'lot.delete')) return;
    await deleteLot(mgr.residenceId, lotId);
  }
  revalidatePath('/', 'layout');
  redirect(`/${localePath(formData.get('locale'))}/lots`);
}

function readLotForm(formData: FormData): LotFormRaw {
  return {
    reference: String(formData.get('reference') ?? ''),
    type: String(formData.get('type') ?? ''),
    floor: String(formData.get('floor') ?? ''),
    surfaceM2: String(formData.get('surfaceM2') ?? ''),
    quotePart: String(formData.get('quotePart') ?? ''),
    charge: String(formData.get('charge') ?? ''),
  };
}
