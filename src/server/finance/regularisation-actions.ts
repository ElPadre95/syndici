'use server';

/**
 * Actions de régularisation annuelle (I3). Réservées au staff (`expense.manage`). La
 * validation est IDEMPOTENTE (l'index partiel refuse une seconde régularisation active sur
 * le même exercice) et l'annulation est douce (`voidedAt`). Toute écriture est tracée.
 */
import { revalidatePath } from 'next/cache';
import { forResidence } from '@/server/db/tenant';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { previewRegularisation } from './regularisation';

export type RegulResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid' | 'already_exists' | 'empty' | string };

async function requireManager() {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'expense.manage')) return null;
  return { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
}

/** Valide la régularisation d'un exercice : fige les provisions, la quote-part et l'écart par lot. */
export async function commitRegularisationAction(formData: FormData): Promise<RegulResult> {
  const mgr = await requireManager();
  if (!mgr) return { ok: false, error: 'forbidden' };
  const exercice = Number(formData.get('exercice'));
  if (!Number.isInteger(exercice) || exercice < 2000 || exercice > 2100) {
    return { ok: false, error: 'invalid' };
  }
  const actx = { personId: mgr.personId, residenceId: mgr.residenceId, role: mgr.role };
  const plan = await previewRegularisation(actx, exercice);
  if (plan.lines.length === 0) return { ok: false, error: 'empty' };

  const scoped = forResidence(mgr.residenceId);
  const effectiveOn = new Date(Date.UTC(exercice, 11, 31)); // fin d'exercice
  try {
    await scoped.regularisation.create({
      data: {
        residenceId: mgr.residenceId,
        exercice,
        effectiveOn,
        totalExpensesMinor: plan.totalExpensesMinor,
        totalProvisionsMinor: plan.totalProvisionsMinor,
        actorPersonId: mgr.personId,
        lines: {
          create: plan.lines.map((l) => ({
            residenceId: mgr.residenceId,
            lotId: l.lotId,
            provisionsMinor: l.provisionsMinor,
            quotePartMinor: l.quotePartMinor,
            adjustmentMinor: l.adjustmentMinor,
          })),
        },
      },
    });
  } catch (e) {
    // Index partiel unique (résidence, exercice) WHERE voidedAt IS NULL → déjà régularisé.
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return { ok: false, error: 'already_exists' };
    }
    throw e;
  }
  await scoped.auditLog.create({
    data: {
      residenceId: mgr.residenceId,
      actorPersonId: mgr.personId,
      action: 'regularisation.commit',
      entityType: 'Regularisation',
      entityId: mgr.residenceId,
      after: {
        exercice,
        totalExpensesMinor: plan.totalExpensesMinor,
        totalProvisionsMinor: plan.totalProvisionsMinor,
        totalAdjustmentMinor: plan.totalAdjustmentMinor,
      },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Annule (annulation douce) une régularisation ; libère l'exercice pour en refaire une. */
export async function reverseRegularisationAction(formData: FormData): Promise<RegulResult> {
  const mgr = await requireManager();
  if (!mgr) return { ok: false, error: 'forbidden' };
  const regularisationId = String(formData.get('regularisationId') ?? '');
  if (!regularisationId) return { ok: false, error: 'invalid' };
  const scoped = forResidence(mgr.residenceId);
  const reg = await scoped.regularisation.findFirst({
    where: { id: regularisationId, voidedAt: null },
    select: { id: true, exercice: true },
  });
  if (!reg) return { ok: false, error: 'invalid' };
  await scoped.regularisation.update({
    where: { id: reg.id },
    data: { voidedAt: new Date(), voidedReason: 'reversal' },
  });
  await scoped.auditLog.create({
    data: {
      residenceId: mgr.residenceId,
      actorPersonId: mgr.personId,
      action: 'regularisation.reverse',
      entityType: 'Regularisation',
      entityId: reg.id,
      after: { exercice: reg.exercice },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
