/**
 * Compte à rebours des contrats fournisseurs (SPEC §7.2). Transcription fidèle du
 * prototype, MAIS comparée à la date RÉELLE (le prototype figeait `2026-06-10`,
 * anomalie M1) :
 *
 *   jours = ceil((echeance - aujourd'hui) / 1 jour)
 *   jours  < 0   -> EXPIRED  (expiré)
 *   jours <= 30  -> SOON     (alerte proche)
 *   sinon        -> OK
 *
 * Tri d'affichage : jours croissant.
 */

import { MS_PER_DAY } from '@/server/finance/status';

export type ContractAlert = 'EXPIRED' | 'SOON' | 'OK';

export const SOON_THRESHOLD_DAYS = 30;

export function daysUntilDeadline(deadline: Date, now: Date = new Date()): number {
  const diff = startOfDay(deadline).getTime() - startOfDay(now).getTime();
  return Math.ceil(diff / MS_PER_DAY);
}

export function contractAlert(daysUntil: number): ContractAlert {
  if (daysUntil < 0) return 'EXPIRED';
  if (daysUntil <= SOON_THRESHOLD_DAYS) return 'SOON';
  return 'OK';
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
