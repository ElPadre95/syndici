/**
 * Statut d'un appel de charges — DÉRIVÉ, jamais stocké (SPEC §7.7bis, decision D19,
 * correction étape 4b). DEUX AXES INDÉPENDANTS :
 *
 *   Règlement (settlement) :   allocated >= amount -> SETTLED
 *                              0 < allocated < amount -> PARTIAL
 *                              allocated <= 0 -> UNSETTLED
 *   Temporalité (temporal) :   now < dueDate -> UPCOMING
 *                              now == dueDate (même jour) -> DUE
 *                              now > dueDate -> OVERDUE
 *
 * Un partiel échu est { PARTIAL, OVERDUE } — les deux à la fois. Le prototype les
 * traitait comme exclusifs (paid|partial|late) ; ici on ne perd plus l'information.
 */

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type SettlementState = 'SETTLED' | 'PARTIAL' | 'UNSETTLED';
export type TemporalState = 'UPCOMING' | 'DUE' | 'OVERDUE';

export interface ChargeState {
  settlement: SettlementState;
  temporal: TemporalState;
}

export interface ChargeStateInput {
  amountMinor: number;
  allocatedMinor: number;
  dueDate: Date;
  now?: Date;
}

export function deriveSettlementState(
  amountMinor: number,
  allocatedMinor: number,
): SettlementState {
  if (!Number.isInteger(amountMinor) || !Number.isInteger(allocatedMinor)) {
    throw new TypeError('Charge amounts must be integer centimes.');
  }
  if (allocatedMinor >= amountMinor) return 'SETTLED';
  if (allocatedMinor > 0) return 'PARTIAL';
  return 'UNSETTLED';
}

export function deriveTemporalState(dueDate: Date, now: Date = new Date()): TemporalState {
  const due = startOfDay(dueDate).getTime();
  const ref = startOfDay(now).getTime();
  if (ref < due) return 'UPCOMING';
  if (ref > due) return 'OVERDUE';
  return 'DUE';
}

export function deriveChargeState(input: ChargeStateInput): ChargeState {
  return {
    settlement: deriveSettlementState(input.amountMinor, input.allocatedMinor),
    temporal: deriveTemporalState(input.dueDate, input.now ?? new Date()),
  };
}

/** Nombre de jours entiers de retard (0 si non échu). */
export function daysLate(dueDate: Date, now: Date = new Date()): number {
  const diff = startOfDay(now).getTime() - startOfDay(dueDate).getTime();
  return diff <= 0 ? 0 : Math.floor(diff / MS_PER_DAY);
}

/** Reste dû (jamais négatif), en centimes. */
export function remainingDueMinor(amountMinor: number, allocatedMinor: number): number {
  return Math.max(0, amountMinor - allocatedMinor);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
