'use server';

/**
 * Actions budget prévisionnel + fonds travaux (I2). Réservées au staff (`expense.manage`).
 * Toute écriture est tracée au journal d'audit.
 */
import { revalidatePath } from 'next/cache';
import { forResidence } from '@/server/db/tenant';
import { prismaTxRunner } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { parseMoneyToCentimes } from '@/server/import/normalize';
import { reverseWorksFundContribution } from './works-fund';

export type I2Result = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' | string };

async function requireManager() {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'expense.manage')) return null;
  return { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
}

/** Fixe (ou met à jour) le budget d'une catégorie pour un exercice. */
export async function setBudgetLineAction(formData: FormData): Promise<I2Result> {
  const mgr = await requireManager();
  if (!mgr) return { ok: false, error: 'forbidden' };
  const exercice = Number(formData.get('exercice'));
  const categoryId = String(formData.get('categoryId') ?? '');
  const amountMinor = parseMoneyToCentimes(String(formData.get('amount') ?? '0')) ?? 0;
  if (!Number.isInteger(exercice) || !categoryId || amountMinor < 0) {
    return { ok: false, error: 'invalid' };
  }
  const scoped = forResidence(mgr.residenceId);
  const existing = await scoped.budgetLine.findFirst({
    where: { exercice, categoryId },
    select: { id: true },
  });
  if (existing) {
    await scoped.budgetLine.update({ where: { id: existing.id }, data: { amountMinor } });
  } else {
    await scoped.budgetLine.create({
      data: { residenceId: mgr.residenceId, exercice, categoryId, amountMinor },
    });
  }
  await scoped.auditLog.create({
    data: {
      residenceId: mgr.residenceId,
      actorPersonId: mgr.personId,
      action: 'budget.set',
      entityType: 'BudgetLine',
      entityId: categoryId,
      after: { exercice, amountMinor },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Enregistre une contribution au fonds travaux (appel dédié). */
export async function addWorksFundContributionAction(formData: FormData): Promise<I2Result> {
  const mgr = await requireManager();
  if (!mgr) return { ok: false, error: 'forbidden' };
  const label = String(formData.get('label') ?? '').trim();
  const amountMinor = parseMoneyToCentimes(String(formData.get('amount') ?? ''));
  const dateStr = String(formData.get('occurredOn') ?? '').trim();
  const occurredOn = dateStr ? new Date(dateStr) : new Date();
  if (!label || amountMinor === null || amountMinor <= 0 || Number.isNaN(occurredOn.getTime())) {
    return { ok: false, error: 'invalid' };
  }
  const scoped = forResidence(mgr.residenceId);
  await scoped.worksFundContribution.create({
    data: { residenceId: mgr.residenceId, amountMinor, label, occurredOn },
  });
  await scoped.auditLog.create({
    data: {
      residenceId: mgr.residenceId,
      actorPersonId: mgr.personId,
      action: 'worksfund.contribute',
      entityType: 'WorksFundContribution',
      entityId: mgr.residenceId,
      after: { amountMinor, label },
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Annule une contribution par écriture inverse. */
export async function reverseWorksFundContributionAction(formData: FormData): Promise<I2Result> {
  const mgr = await requireManager();
  if (!mgr) return { ok: false, error: 'forbidden' };
  const contributionId = String(formData.get('contributionId') ?? '');
  if (!contributionId) return { ok: false, error: 'invalid' };
  const res = await reverseWorksFundContribution(prismaTxRunner(), {
    residenceId: mgr.residenceId,
    contributionId,
    actorPersonId: mgr.personId,
  });
  if (!res.ok) return { ok: false, error: res.reason };
  revalidatePath('/', 'layout');
  return { ok: true };
}
