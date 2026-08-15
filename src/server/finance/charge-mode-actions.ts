'use server';

/**
 * Mode de calcul des appels de charges (I1) — syndic (`residence.settings`). FORFAIT ou
 * TANTIEMES, avec le budget mensuel réparti aux quotes-parts. Tracé au journal d'audit.
 */
import { revalidatePath } from 'next/cache';
import { getBaseClient } from '@/server/db/client';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { parseMoneyToCentimes } from '@/server/import/normalize';

export type ChargeModeResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' };

const MODES = ['FORFAIT', 'TANTIEMES'] as const;

export async function updateChargeModeAction(formData: FormData): Promise<ChargeModeResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'residence.settings')) {
    return { ok: false, error: 'forbidden' };
  }
  const mode = String(formData.get('chargeMode') ?? '');
  const monthlyBudgetMinor = parseMoneyToCentimes(String(formData.get('monthlyBudget') ?? '0')) ?? 0;
  if (!MODES.includes(mode as (typeof MODES)[number]) || monthlyBudgetMinor < 0) {
    return { ok: false, error: 'invalid' };
  }

  await getBaseClient().$transaction(async (tx) => {
    await tx.residence.update({
      where: { id: ctx.activeId! },
      data: { chargeMode: mode as (typeof MODES)[number], monthlyBudgetMinor },
    });
    await tx.auditLog.create({
      data: {
        residenceId: ctx.activeId!,
        actorPersonId: ctx.personId,
        action: 'residence.chargeMode',
        entityType: 'Residence',
        entityId: ctx.activeId!,
        after: { chargeMode: mode, monthlyBudgetMinor },
      },
    });
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
