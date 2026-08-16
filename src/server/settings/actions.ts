'use server';

/**
 * Actions de réglages (F1). Réservées au syndic (`residence.settings`). TOUTE modification
 * est tracée au journal d'audit. La résidence n'est pas un modèle scopé (c'est LA résidence)
 * → client de base ; les modèles tenant (règle, catégories) sont scopés par `residenceId`
 * explicite dans le `where`.
 */
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { getBaseClient } from '@/server/db/client';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import {
  validateResidenceEdit,
  validateReminderRule,
  validateCategoryLabel,
  type ResidenceEditRaw,
  type ReminderRuleRaw,
} from './validation';
import type {
  ResidenceSettingsResult,
  ReminderRuleSettingsResult,
  CategoryActionResult,
} from './action-types';

type Admin =
  | { ok: true; residenceId: string; personId: string }
  | { ok: false; error: 'forbidden' | 'no_active_residence' };

async function requireSettingsAdmin(): Promise<Admin> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'residence.settings')) return { ok: false, error: 'forbidden' };
  return { ok: true, residenceId: ctx.activeId, personId: ctx.personId };
}

type Tx = Prisma.TransactionClient;
function audit(
  tx: Tx,
  residenceId: string,
  actorPersonId: string,
  action: string,
  entityType: string,
  entityId: string,
  after: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({
    data: { residenceId, actorPersonId, action, entityType, entityId, after },
  });
}

export async function updateResidenceSettingsAction(
  formData: FormData,
): Promise<ResidenceSettingsResult> {
  const admin = await requireSettingsAdmin();
  if (!admin.ok) return { ok: false, formError: admin.error };

  const raw: ResidenceEditRaw = {
    name: String(formData.get('name') ?? ''),
    address: String(formData.get('address') ?? ''),
    city: String(formData.get('city') ?? ''),
    type: String(formData.get('type') ?? ''),
    chargeAppt: String(formData.get('chargeAppt') ?? ''),
    chargeVilla: String(formData.get('chargeVilla') ?? ''),
    dueDay: String(formData.get('dueDay') ?? ''),
  };
  const v = validateResidenceEdit(raw);
  if (!v.ok) return { ok: false, errors: v.errors };

  await getBaseClient().$transaction(async (tx) => {
    await tx.residence.update({ where: { id: admin.residenceId }, data: v.value });
    await audit(
      tx,
      admin.residenceId,
      admin.personId,
      'residence.update',
      'Residence',
      admin.residenceId,
      {
        name: v.value.name,
        type: v.value.type,
        defaultChargeApptMinor: v.value.defaultChargeApptMinor,
        defaultChargeVillaMinor: v.value.defaultChargeVillaMinor,
        dueDayOfMonth: v.value.dueDayOfMonth,
      },
    );
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function updateReminderRuleAction(
  formData: FormData,
): Promise<ReminderRuleSettingsResult> {
  const admin = await requireSettingsAdmin();
  if (!admin.ok) return { ok: false, formError: admin.error };

  const raw: ReminderRuleRaw = {
    overdueThresholdDays: String(formData.get('overdueThresholdDays') ?? ''),
    minDaysBetweenReminders: String(formData.get('minDaysBetweenReminders') ?? ''),
    concernedSettlementStates: formData.getAll('concernedSettlementStates').map(String),
    formalNoticeThresholdDays: String(formData.get('formalNoticeThresholdDays') ?? ''),
  };
  const v = validateReminderRule(raw);
  if (!v.ok) return { ok: false, errors: v.errors };

  const base = getBaseClient();
  const rule = await base.reminderRule.findFirst({
    where: { residenceId: admin.residenceId, active: true },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  if (!rule) return { ok: false, formError: 'not_found' };

  await base.$transaction(async (tx) => {
    await tx.reminderRule.update({ where: { id: rule.id }, data: v.value });
    await audit(
      tx,
      admin.residenceId,
      admin.personId,
      'reminder.rule.update',
      'ReminderRule',
      rule.id,
      {
        overdueThresholdDays: v.value.overdueThresholdDays,
        minDaysBetweenReminders: v.value.minDaysBetweenReminders,
        concernedSettlementStates: v.value.concernedSettlementStates,
        formalNoticeThresholdDays: v.value.formalNoticeThresholdDays,
      },
    );
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function addCategoryAction(formData: FormData): Promise<CategoryActionResult> {
  const admin = await requireSettingsAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };
  const v = validateCategoryLabel(String(formData.get('label') ?? ''));
  if (!v.ok) return { ok: false, error: 'label_required' };

  const base = getBaseClient();
  const count = await base.expenseCategory.count({ where: { residenceId: admin.residenceId } });
  try {
    await base.$transaction(async (tx) => {
      const c = await tx.expenseCategory.create({
        data: { residenceId: admin.residenceId, label: v.label, sortOrder: count },
      });
      await audit(
        tx,
        admin.residenceId,
        admin.personId,
        'category.create',
        'ExpenseCategory',
        c.id,
        {
          label: v.label,
        },
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'duplicate' };
    }
    throw e;
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function renameCategoryAction(formData: FormData): Promise<CategoryActionResult> {
  const admin = await requireSettingsAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };
  const id = String(formData.get('id') ?? '');
  const v = validateCategoryLabel(String(formData.get('label') ?? ''));
  if (!v.ok) return { ok: false, error: 'label_required' };

  const base = getBaseClient();
  try {
    const res = await base.$transaction(async (tx) => {
      const updated = await tx.expenseCategory.updateMany({
        where: { id, residenceId: admin.residenceId },
        data: { label: v.label },
      });
      if (updated.count === 0) return false;
      await audit(tx, admin.residenceId, admin.personId, 'category.rename', 'ExpenseCategory', id, {
        label: v.label,
      });
      return true;
    });
    if (!res) return { ok: false, error: 'not_found' };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'duplicate' };
    }
    throw e;
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setCategoryArchivedAction(formData: FormData): Promise<CategoryActionResult> {
  const admin = await requireSettingsAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };
  const id = String(formData.get('id') ?? '');
  const archived = String(formData.get('archived') ?? '') === 'true';

  const base = getBaseClient();
  const res = await base.$transaction(async (tx) => {
    const updated = await tx.expenseCategory.updateMany({
      where: { id, residenceId: admin.residenceId },
      data: { archivedAt: archived ? new Date() : null },
    });
    if (updated.count === 0) return false;
    await audit(
      tx,
      admin.residenceId,
      admin.personId,
      archived ? 'category.archive' : 'category.unarchive',
      'ExpenseCategory',
      id,
      { archived },
    );
    return true;
  });
  if (!res) return { ok: false, error: 'not_found' };
  revalidatePath('/', 'layout');
  return { ok: true };
}
