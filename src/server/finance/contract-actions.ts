'use server';

/**
 * Actions de contrat fournisseur (C3). Créer un contrat ou l'archiver. Gardé par
 * `can(role, 'contract.manage')` — staff. Le compte à rebours reste dérivé (jamais saisi).
 */
import { revalidatePath } from 'next/cache';
import { prismaTxRunner } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { can, type AppRole } from '@/server/auth/permissions';
import { parseMoneyToCentimes } from '@/server/import/normalize';
import {
  writeContract,
  archiveContract,
  CONTRACT_FREQUENCIES,
  type ContractFrequency,
} from './contracts';
import type { ContractActionResult } from './contract-action-types';

type Manager =
  | { ok: true; ctx: { personId: string; residenceId: string; role: AppRole } }
  | { ok: false; error: 'forbidden' | 'no_active_residence' };

async function requireContractManager(): Promise<Manager> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'contract.manage')) return { ok: false, error: 'forbidden' };
  return { ok: true, ctx: { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role } };
}

export async function recordContractAction(formData: FormData): Promise<ContractActionResult> {
  const rec = await requireContractManager();
  if (!rec.ok) return { ok: false, error: rec.error };

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'name_required' };

  const endStr = String(formData.get('endDate') ?? '');
  const endDate = endStr ? new Date(endStr) : new Date(NaN);
  if (Number.isNaN(endDate.getTime())) return { ok: false, error: 'invalid_date' };

  const startStr = String(formData.get('startDate') ?? '');
  const startDate = startStr ? new Date(startStr) : null;
  if (startDate && Number.isNaN(startDate.getTime())) return { ok: false, error: 'invalid_date' };

  // Montant optionnel : vide = null ; sinon doit être valide et positif.
  const amountRaw = String(formData.get('amount') ?? '').trim();
  let amountMinor: number | null = null;
  if (amountRaw) {
    const parsed = parseMoneyToCentimes(amountRaw);
    if (parsed === null || parsed < 0) return { ok: false, error: 'invalid_amount' };
    amountMinor = parsed;
  }

  const supplierName = String(formData.get('supplierName') ?? '').trim() || null;
  const rawFreq = String(formData.get('frequency') ?? 'ANNUEL');
  const frequency: ContractFrequency = CONTRACT_FREQUENCIES.includes(rawFreq as ContractFrequency)
    ? (rawFreq as ContractFrequency)
    : 'ANNUEL';

  await writeContract(prismaTxRunner(), {
    residenceId: rec.ctx.residenceId,
    name,
    supplierName,
    amountMinor,
    startDate,
    endDate,
    frequency,
    actorPersonId: rec.ctx.personId,
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function archiveContractAction(formData: FormData): Promise<ContractActionResult> {
  const rec = await requireContractManager();
  if (!rec.ok) return { ok: false, error: rec.error };

  const contractId = String(formData.get('contractId') ?? '');
  const res = await archiveContract(prismaTxRunner(), {
    residenceId: rec.ctx.residenceId,
    contractId,
    actorPersonId: rec.ctx.personId,
  });
  if (!res.ok) return { ok: false, error: res.reason };
  revalidatePath('/', 'layout');
  return { ok: true };
}
