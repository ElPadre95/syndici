/**
 * Moteur de détection des relances (SPEC §7.1, decision D18, adapté à l'axe règlement
 * de la correction 4b). Transcription FIDÈLE du prototype, y compris l'anti-harcèlement,
 * paramétrée par une règle configurable et versionnée (`ReminderRule`) :
 *
 *   - états de règlement concernés : PARTIAL, UNSETTLED  (le prototype relançait
 *     « les partiels comme les retards ») ;
 *   - seuil de retard : jours de retard >= 3  (overdueThresholdDays) ;
 *   - anti-harcèlement : exclu si relancé il y a < 4 jours (minDaysBetweenReminders) ;
 *   - tri : retard décroissant.
 *
 * `settlement` et `daysLate` sont dérivés (src/server/finance/status.ts), pas stockés.
 */

import { MS_PER_DAY, type SettlementState } from '@/server/finance/status';

export interface ReminderRuleConfig {
  overdueThresholdDays: number;
  minDaysBetweenReminders: number;
  concernedSettlementStates: readonly SettlementState[];
  lateFeeThresholdDays: number;
}

/** Valeurs par défaut = valeurs exactes du prototype (SPEC §7.1). */
export const DEFAULT_REMINDER_RULE: ReminderRuleConfig = {
  overdueThresholdDays: 3,
  minDaysBetweenReminders: 4,
  concernedSettlementStates: ['PARTIAL', 'UNSETTLED'],
  lateFeeThresholdDays: 10,
};

export interface ReminderCandidate {
  lotId: string;
  settlement: SettlementState;
  daysLate: number;
  /** Dernière relance envoyée pour ce lot (null si jamais). */
  lastReminderAt: Date | null;
}

/**
 * Renvoie les candidats à relancer, triés par retard décroissant.
 * Reproduit exactement `detecterRelancesNecessaires` du prototype.
 */
export function detectReminders(
  candidates: readonly ReminderCandidate[],
  rule: ReminderRuleConfig = DEFAULT_REMINDER_RULE,
  now: Date = new Date(),
): ReminderCandidate[] {
  return candidates
    .filter((c) => {
      if (!rule.concernedSettlementStates.includes(c.settlement)) return false;
      if (c.daysLate < rule.overdueThresholdDays) return false;
      if (c.lastReminderAt) {
        const daysSince = Math.floor((now.getTime() - c.lastReminderAt.getTime()) / MS_PER_DAY);
        if (daysSince < rule.minDaysBetweenReminders) return false;
      }
      return true;
    })
    .sort((a, b) => b.daysLate - a.daysLate);
}

/** Le message de relance mentionne des frais de retard si le seuil est atteint. */
export function lateFeeApplies(daysLate: number, rule: ReminderRuleConfig = DEFAULT_REMINDER_RULE) {
  return daysLate >= rule.lateFeeThresholdDays;
}
