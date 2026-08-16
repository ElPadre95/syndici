/**
 * Mise en demeure (I4) — données d'une lettre formelle de recouvrement pour UN lot. On
 * réutilise le moteur de dunning (mêmes seuils configurables) mais SANS l'anti-harcèlement :
 * une mise en demeure peut être réimprimée même juste après un rappel. Le lot est « éligible »
 * quand son retard atteint `formalNoticeThresholdDays`. Aucune écriture ici (lecture seule).
 */
import { forResidence } from '@/server/db/tenant';
import { getBaseClient } from '@/server/db/client';
import { prismaExecutor } from '@/server/db/sql';
import { listResidents } from '@/server/auth/person-access';
import { deriveSettlementState, remainingDueMinor, daysLate } from './status';
import { evaluateDunning, type DunningRule, type LotDunningInput } from './dunning';
import type { ActiveContext } from '@/server/auth/context';

/** Délai de régularisation accordé par la lettre avant poursuite (jours). */
export const FORMAL_NOTICE_DEADLINE_DAYS = 15;

const DEFAULT_RULE: DunningRule = {
  overdueThresholdDays: 3,
  minDaysBetweenReminders: 0, // désactivé ici (pas d'anti-harcèlement pour une mise en demeure)
  concernedSettlementStates: ['PARTIAL', 'UNSETTLED'],
  lateFeeThresholdDays: 10,
  formalNoticeThresholdDays: 30,
};

export interface FormalNoticeData {
  lotReference: string;
  recipientName: string | null;
  residence: { name: string; orgName: string | null };
  amountDueMinor: number;
  retardDays: number;
  periods: { year: number; month: number }[];
  eligible: boolean; // retard >= seuil de mise en demeure
  deadlineDays: number;
}

/** Prépare la lettre de mise en demeure d'un lot, ou `null` si le lot n'existe pas. */
export async function getFormalNotice(
  ctx: ActiveContext,
  lotId: string,
  now: Date = new Date(),
): Promise<FormalNoticeData | null> {
  const scoped = forResidence(ctx.residenceId);
  const lot = await scoped.lot.findUnique({
    where: { id: lotId },
    select: { id: true, reference: true },
  });
  if (!lot) return null;

  const [ruleRow, calls, payer, residence, mandate] = await Promise.all([
    scoped.reminderRule.findFirst({
      where: { active: true },
      orderBy: { version: 'desc' },
      select: {
        overdueThresholdDays: true,
        concernedSettlementStates: true,
        lateFeeThresholdDays: true,
        formalNoticeThresholdDays: true,
      },
    }),
    scoped.chargeCall.findMany({
      where: { lotId, voidedAt: null },
      select: { id: true, dueDate: true, amountMinor: true, periodYear: true, periodMonth: true },
    }),
    scoped.lotAttachment.findFirst({
      where: { lotId, endDate: null, isChargePayer: true },
      select: { personId: true },
    }),
    getBaseClient().residence.findUnique({ where: { id: ctx.residenceId }, select: { name: true } }),
    scoped.mandate.findFirst({
      where: { status: 'ACTIVE' },
      select: { organization: { select: { name: true } } },
    }),
  ]);
  if (!residence) return null;

  const rule: DunningRule = ruleRow
    ? {
        ...DEFAULT_RULE,
        overdueThresholdDays: ruleRow.overdueThresholdDays,
        concernedSettlementStates: ruleRow.concernedSettlementStates as DunningRule['concernedSettlementStates'],
        lateFeeThresholdDays: ruleRow.lateFeeThresholdDays,
        formalNoticeThresholdDays: ruleRow.formalNoticeThresholdDays,
      }
    : DEFAULT_RULE;

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

  let recipientName: string | null = null;
  if (payer?.personId) {
    for (const p of await listResidents(prismaExecutor(), ctx)) {
      if (p.id === payer.personId) recipientName = `${p.firstName} ${p.lastName}`.trim();
    }
  }

  const input: LotDunningInput = {
    lotId: lot.id,
    lotReference: lot.reference,
    recipientPersonId: payer?.personId ?? null,
    recipientName,
    recipientPhone: null,
    recipientLocale: 'fr',
    calls: calls.map((c) => {
      const alloc = Math.max(0, allocByCall.get(c.id) ?? 0);
      return {
        settlement: deriveSettlementState(c.amountMinor, Math.min(alloc, c.amountMinor)),
        daysLate: daysLate(c.dueDate, now),
        remainingMinor: remainingDueMinor(c.amountMinor, alloc),
        periodYear: c.periodYear,
        periodMonth: c.periodMonth,
      };
    }),
    remindersSent: 0,
    lastReminderAt: null, // pas d'anti-harcèlement pour la mise en demeure
  };

  const item = evaluateDunning([input], rule, now)[0];
  return {
    lotReference: lot.reference,
    recipientName,
    residence: { name: residence.name, orgName: mandate?.organization?.name ?? null },
    amountDueMinor: item?.amountDueMinor ?? 0,
    retardDays: item?.retardDays ?? 0,
    periods: item?.periods ?? [],
    eligible: item?.stage === 'MISE_EN_DEMEURE',
    deadlineDays: FORMAL_NOTICE_DEADLINE_DAYS,
  };
}
