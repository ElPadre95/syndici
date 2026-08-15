/**
 * Lectures des réglages (F1) : résidence, règle de relance active, catégories de
 * dépenses (archivées comprises), abonnement (plan + nombre d'unités gérées).
 */
import { getBaseClient } from '@/server/db/client';
import { forResidence } from '@/server/db/tenant';
import type { ActiveContext } from '@/server/auth/context';

export interface ResidenceSettings {
  name: string;
  address: string | null;
  city: string | null;
  type: string;
  defaultChargeApptMinor: number;
  defaultChargeVillaMinor: number;
  dueDayOfMonth: number;
}

export async function getResidenceSettings(residenceId: string): Promise<ResidenceSettings | null> {
  return getBaseClient().residence.findUnique({
    where: { id: residenceId },
    select: {
      name: true,
      address: true,
      city: true,
      type: true,
      defaultChargeApptMinor: true,
      defaultChargeVillaMinor: true,
      dueDayOfMonth: true,
    },
  });
}

export interface LateFeeSettings {
  autoLateFee: boolean;
  fixedMinor: number;
  percentBps: number;
  capMinor: number | null;
}

/** Config des frais de retard (H2) — résidence. Désactivée par défaut. */
export async function getLateFeeSettings(residenceId: string): Promise<LateFeeSettings | null> {
  const r = await getBaseClient().residence.findUnique({
    where: { id: residenceId },
    select: {
      autoLateFee: true,
      lateFeeFixedMinor: true,
      lateFeePercentBps: true,
      lateFeeCapMinor: true,
    },
  });
  if (!r) return null;
  return {
    autoLateFee: r.autoLateFee,
    fixedMinor: r.lateFeeFixedMinor,
    percentBps: r.lateFeePercentBps,
    capMinor: r.lateFeeCapMinor,
  };
}

export interface ReminderRuleSettings {
  id: string;
  overdueThresholdDays: number;
  minDaysBetweenReminders: number;
  concernedSettlementStates: string[];
  lateFeeThresholdDays: number;
}

export async function getActiveReminderRule(
  residenceId: string,
): Promise<ReminderRuleSettings | null> {
  const r = await forResidence(residenceId).reminderRule.findFirst({
    where: { active: true },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      overdueThresholdDays: true,
      minDaysBetweenReminders: true,
      concernedSettlementStates: true,
      lateFeeThresholdDays: true,
    },
  });
  return r;
}

export interface CategorySetting {
  id: string;
  label: string;
  archived: boolean;
}

export async function listCategoriesForSettings(ctx: ActiveContext): Promise<CategorySetting[]> {
  const rows = await forResidence(ctx.residenceId).expenseCategory.findMany({
    orderBy: [{ archivedAt: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, label: true, archivedAt: true },
  });
  return rows.map((c) => ({ id: c.id, label: c.label, archived: c.archivedAt != null }));
}

export interface Subscription {
  plan: string;
  unitsCount: number;
}

export async function getSubscription(ctx: ActiveContext): Promise<Subscription> {
  const [residence, unitsCount] = await Promise.all([
    getBaseClient().residence.findUnique({
      where: { id: ctx.residenceId },
      select: { plan: true },
    }),
    forResidence(ctx.residenceId).lot.count({ where: { archivedAt: null } }),
  ]);
  return { plan: residence?.plan ?? 'STARTER', unitsCount };
}
