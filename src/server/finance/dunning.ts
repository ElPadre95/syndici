/**
 * Détection des relances nécessaires (E1) — transcription EXACTE du moteur §7.1 du
 * prototype (`detecterRelancesNecessaires`), porté sur le modèle à deux axes :
 *
 *   - statuts concernés : `rule.concernedSettlementStates` (défaut [PARTIAL, UNSETTLED]) ;
 *   - seuil de retard   : `rule.overdueThresholdDays` (défaut 3 j) sur l'axe temporalité ;
 *   - anti-harcèlement  : exclu si la dernière relance date de moins de
 *                         `rule.minDaysBetweenReminders` jours (défaut 4) ;
 *   - ordre             : retard DÉCROISSANT.
 *
 * Les seuils NE sont jamais codés en dur : ils viennent de l'entité `ReminderRule`
 * (configurable par résidence). Le cœur (`evaluateDunning`) est PUR et testable.
 */
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor } from '@/server/db/sql';
import { listResidents } from '@/server/auth/person-access';
import { deriveSettlementState, remainingDueMinor, daysLate, type SettlementState } from './status';
import type { ActiveContext } from '@/server/auth/context';

const DAY_MS = 86_400_000;

export interface DunningRule {
  overdueThresholdDays: number;
  minDaysBetweenReminders: number;
  concernedSettlementStates: SettlementState[];
  lateFeeThresholdDays: number;
}

export interface DunningCall {
  settlement: SettlementState;
  daysLate: number;
  remainingMinor: number;
  periodYear: number;
  periodMonth: number;
}

export interface LotDunningInput {
  lotId: string;
  lotReference: string;
  recipientPersonId: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientLocale: string;
  calls: DunningCall[];
  remindersSent: number;
  lastReminderAt: Date | null;
}

export interface DunningItem {
  lotId: string;
  lotReference: string;
  recipientPersonId: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientLocale: string;
  amountDueMinor: number;
  retardDays: number;
  lateFee: boolean; // retard >= lateFeeThresholdDays (le message mentionnera les frais)
  periods: { year: number; month: number }[];
  remindersSent: number;
  lastReminderAt: string | null;
}

/**
 * Cœur du moteur §7.1. Pour chaque lot : ne retient que les appels dont l'état est
 * concerné ET dont le retard atteint le seuil ; exclut le lot si sa dernière relance
 * est trop récente (anti-harcèlement) ; trie par retard décroissant. PURE.
 */
export function evaluateDunning(
  lots: readonly LotDunningInput[],
  rule: DunningRule,
  now: Date,
): DunningItem[] {
  const items: DunningItem[] = [];
  for (const lot of lots) {
    const qualifying = lot.calls.filter(
      (c) =>
        rule.concernedSettlementStates.includes(c.settlement) &&
        c.daysLate >= rule.overdueThresholdDays,
    );
    if (qualifying.length === 0) continue;

    // Anti-harcèlement : exclu si relancé il y a moins de `minDaysBetweenReminders` jours.
    if (lot.lastReminderAt) {
      const joursDepuis = Math.floor((now.getTime() - lot.lastReminderAt.getTime()) / DAY_MS);
      if (joursDepuis < rule.minDaysBetweenReminders) continue;
    }

    const retardDays = Math.max(...qualifying.map((c) => c.daysLate));
    items.push({
      lotId: lot.lotId,
      lotReference: lot.lotReference,
      recipientPersonId: lot.recipientPersonId,
      recipientName: lot.recipientName,
      recipientPhone: lot.recipientPhone,
      recipientLocale: lot.recipientLocale,
      amountDueMinor: qualifying.reduce((s, c) => s + c.remainingMinor, 0),
      retardDays,
      lateFee: retardDays >= rule.lateFeeThresholdDays,
      periods: qualifying
        .map((c) => ({ year: c.periodYear, month: c.periodMonth }))
        .sort((a, b) => a.year - b.year || a.month - b.month),
      remindersSent: lot.remindersSent,
      lastReminderAt: lot.lastReminderAt ? lot.lastReminderAt.toISOString() : null,
    });
  }
  return items.sort((a, b) => b.retardDays - a.retardDays);
}

export interface DunningResult {
  items: DunningItem[];
  hasRule: boolean;
}

/** Liste des relances nécessaires pour la résidence active, selon sa `ReminderRule`. */
export async function listDunning(
  ctx: ActiveContext,
  now: Date = new Date(),
): Promise<DunningResult> {
  const scoped = forResidence(ctx.residenceId);
  const ruleRow = await scoped.reminderRule.findFirst({
    where: { active: true },
    orderBy: { version: 'desc' },
    select: {
      overdueThresholdDays: true,
      minDaysBetweenReminders: true,
      concernedSettlementStates: true,
      lateFeeThresholdDays: true,
    },
  });
  if (!ruleRow) return { items: [], hasRule: false };
  const rule: DunningRule = {
    overdueThresholdDays: ruleRow.overdueThresholdDays,
    minDaysBetweenReminders: ruleRow.minDaysBetweenReminders,
    concernedSettlementStates: ruleRow.concernedSettlementStates as SettlementState[],
    lateFeeThresholdDays: ruleRow.lateFeeThresholdDays,
  };

  const [lots, calls, reminders, payers] = await Promise.all([
    scoped.lot.findMany({ where: { archivedAt: null }, select: { id: true, reference: true } }),
    scoped.chargeCall.findMany({
      where: { voidedAt: null },
      select: {
        id: true,
        lotId: true,
        dueDate: true,
        amountMinor: true,
        periodYear: true,
        periodMonth: true,
      },
    }),
    scoped.reminder.findMany({ select: { lotId: true, sentAt: true } }),
    scoped.lotAttachment.findMany({
      where: { endDate: null, isChargePayer: true },
      select: { lotId: true, personId: true },
    }),
  ]);

  const callIds = calls.map((c) => c.id);
  const allocs = callIds.length
    ? await scoped.paymentAllocation.findMany({
        where: { chargeCallId: { in: callIds } },
        select: { chargeCallId: true, amountMinor: true },
      })
    : [];
  const allocByCall = new Map<string, number>();
  for (const a of allocs)
    allocByCall.set(a.chargeCallId, (allocByCall.get(a.chargeCallId) ?? 0) + a.amountMinor);

  // Relances : compte + dernière date par lot.
  const remByLot = new Map<string, { count: number; last: Date | null }>();
  for (const r of reminders) {
    const cur = remByLot.get(r.lotId) ?? { count: 0, last: null };
    cur.count += 1;
    if (!cur.last || r.sentAt > cur.last) cur.last = r.sentAt;
    remByLot.set(r.lotId, cur);
  }
  const payerByLot = new Map(payers.map((p) => [p.lotId, p.personId]));
  const nameById = new Map<string, string>();
  const phoneById = new Map<string, string | null>();
  const localeById = new Map<string, string>();
  for (const p of await listResidents(prismaExecutor(), ctx)) {
    nameById.set(p.id, `${p.firstName} ${p.lastName}`.trim());
    phoneById.set(p.id, p.phone);
    localeById.set(p.id, p.preferredLocale);
  }

  const callsByLot = new Map<string, DunningCall[]>();
  for (const c of calls) {
    const alloc = Math.max(0, allocByCall.get(c.id) ?? 0);
    const capped = Math.min(alloc, c.amountMinor);
    const list = callsByLot.get(c.lotId) ?? [];
    list.push({
      settlement: deriveSettlementState(c.amountMinor, capped),
      daysLate: daysLate(c.dueDate, now),
      remainingMinor: remainingDueMinor(c.amountMinor, alloc),
      periodYear: c.periodYear,
      periodMonth: c.periodMonth,
    });
    callsByLot.set(c.lotId, list);
  }

  const inputs: LotDunningInput[] = lots.map((lot) => {
    const rem = remByLot.get(lot.id);
    const payerId = payerByLot.get(lot.id) ?? null;
    return {
      lotId: lot.id,
      lotReference: lot.reference,
      recipientPersonId: payerId,
      recipientName: payerId ? (nameById.get(payerId) ?? null) : null,
      recipientPhone: payerId ? (phoneById.get(payerId) ?? null) : null,
      recipientLocale: (payerId ? localeById.get(payerId) : null) ?? 'fr',
      calls: callsByLot.get(lot.id) ?? [],
      remindersSent: rem?.count ?? 0,
      lastReminderAt: rem?.last ?? null,
    };
  });

  return { items: evaluateDunning(inputs, rule, now), hasRule: true };
}
