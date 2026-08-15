'use server';

/**
 * Actions frais de retard (H2). Config réservée au syndic (`residence.settings`) ;
 * génération et annulation au staff gestionnaire (`charge.manage`). Toute écriture est
 * tracée au journal d'audit. Jamais de déclenchement automatique : la génération est une
 * action explicite.
 */
import { revalidatePath } from 'next/cache';
import { getBaseClient } from '@/server/db/client';
import { prismaTxRunner } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { parseMoneyToCentimes } from '@/server/import/normalize';
import { generateLateFees, reverseLateFee } from './late-fees';

export type LateFeeConfigResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' };

/** Configurer les frais de retard (syndic) : activation + montant fixe + % + plafond. */
export async function updateLateFeeConfigAction(formData: FormData): Promise<LateFeeConfigResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'residence.settings')) {
    return { ok: false, error: 'forbidden' };
  }
  const enabled = formData.get('autoLateFee') === 'on' || formData.get('autoLateFee') === 'true';
  const fixed = parseMoneyToCentimes(String(formData.get('fixed') ?? '0')) ?? 0;
  const percent = Number(String(formData.get('percent') ?? '0').replace(',', '.'));
  const capRaw = String(formData.get('cap') ?? '').trim();
  const cap = capRaw === '' ? null : parseMoneyToCentimes(capRaw);
  if (fixed < 0 || !Number.isFinite(percent) || percent < 0 || percent > 100 || cap === undefined) {
    return { ok: false, error: 'invalid' };
  }
  const percentBps = Math.round(percent * 100); // 5 % → 500 pdb

  await getBaseClient().$transaction(async (tx) => {
    await tx.residence.update({
      where: { id: ctx.activeId! },
      data: {
        autoLateFee: enabled,
        lateFeeFixedMinor: fixed,
        lateFeePercentBps: percentBps,
        lateFeeCapMinor: cap && cap > 0 ? cap : null,
      },
    });
    await tx.auditLog.create({
      data: {
        residenceId: ctx.activeId!,
        actorPersonId: ctx.personId,
        action: 'latefee.config',
        entityType: 'Residence',
        entityId: ctx.activeId!,
        after: { autoLateFee: enabled, fixedMinor: fixed, percentBps, capMinor: cap ?? null },
      },
    });
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export type GenerateResult =
  | { ok: true; created: number; disabled: boolean }
  | { ok: false; error: 'forbidden' };

/** Générer les frais de retard (staff). Idempotent (ne double jamais). */
export async function generateLateFeesAction(): Promise<GenerateResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'charge.manage')) {
    return { ok: false, error: 'forbidden' };
  }
  const res = await generateLateFees({
    personId: ctx.personId,
    residenceId: ctx.activeId,
    role: ctx.role,
  });
  revalidatePath('/', 'layout');
  return { ok: true, created: res.created, disabled: res.disabled };
}

export type ReverseResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' | string };

/** Annuler un frais de retard par écriture inverse (staff). */
export async function reverseLateFeeAction(formData: FormData): Promise<ReverseResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'charge.manage')) {
    return { ok: false, error: 'forbidden' };
  }
  const lateFeeId = String(formData.get('lateFeeId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!lateFeeId || !reason) return { ok: false, error: 'invalid' };
  const res = await reverseLateFee(prismaTxRunner(), {
    residenceId: ctx.activeId,
    lateFeeId,
    reason,
    actorPersonId: ctx.personId,
  });
  if (!res.ok) return { ok: false, error: res.reason };
  revalidatePath('/', 'layout');
  return { ok: true };
}
