'use server';

/**
 * Actions de génération de campagnes d'appels de charges (B1). Deux temps : aperçu
 * (aucune écriture) puis génération (idempotente). Toute action passe par le point
 * d'application des autorisations : `can(role, 'charge.manage')` — staff uniquement.
 */
import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/server/session';
import { can, type AppRole } from '@/server/auth/permissions';
import { previewCampaign, generateCampaign } from './campaigns';
import type { PreviewCampaignResult, GenerateCampaignResult } from './campaign-action-types';

type Manager =
  | { ok: true; ctx: { personId: string; residenceId: string; role: AppRole } }
  | { ok: false; error: 'forbidden' | 'no_active_residence' };

async function requireChargeManager(): Promise<Manager> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'charge.manage')) return { ok: false, error: 'forbidden' };
  return { ok: true, ctx: { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role } };
}

function validPeriod(year: number, month: number): boolean {
  return (
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  );
}

export async function previewCampaignAction(
  year: number,
  month: number,
): Promise<PreviewCampaignResult> {
  const mgr = await requireChargeManager();
  if (!mgr.ok) return { ok: false, error: mgr.error };
  if (!validPeriod(year, month)) return { ok: false, error: 'invalid_period' };
  const preview = await previewCampaign(mgr.ctx, { year, month });
  if (!preview) return { ok: false, error: 'not_found' };
  return { ok: true, preview };
}

export async function generateCampaignAction(
  year: number,
  month: number,
): Promise<GenerateCampaignResult> {
  const mgr = await requireChargeManager();
  if (!mgr.ok) return { ok: false, error: mgr.error };
  if (!validPeriod(year, month)) return { ok: false, error: 'invalid_period' };
  const result = await generateCampaign(mgr.ctx, { year, month });
  revalidatePath('/', 'layout');
  return { ok: true, result };
}
