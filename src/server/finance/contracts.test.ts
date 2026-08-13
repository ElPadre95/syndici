/**
 * Compte à rebours des contrats (C3) — cœur PUR (SPEC §7.2). Au jour près, contre la
 * date RÉELLE (le M1 « date figée » du prototype est corrigé). Paliers : < 0 « Expiré »
 * (rouge), ≤ 30 orange, sinon vert. Bornes 0 et 30 incluses côté « soon ».
 */
import { describe, it, expect } from 'vitest';
import { contractCountdown } from './contracts';

const NOW = new Date('2026-06-10T12:00:00Z'); // heure quelconque : on compare au jour près
const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('contractCountdown (SPEC §7.2)', () => {
  it('échéance aujourd’hui : 0 jour, palier « soon »', () => {
    expect(contractCountdown(at('2026-06-10'), NOW)).toEqual({ daysUntil: 0, tier: 'soon' });
  });

  it('borne 30 jours incluse dans « soon »', () => {
    expect(contractCountdown(at('2026-07-10'), NOW)).toEqual({ daysUntil: 30, tier: 'soon' });
  });

  it('31 jours bascule en « ok » (vert)', () => {
    expect(contractCountdown(at('2026-07-11'), NOW)).toEqual({ daysUntil: 31, tier: 'ok' });
  });

  it('échéance dépassée : négatif, « expired » (rouge)', () => {
    expect(contractCountdown(at('2026-06-05'), NOW)).toEqual({ daysUntil: -5, tier: 'expired' });
  });

  it('l’heure de la journée n’influe pas (comparaison au jour près)', () => {
    const lateNow = new Date('2026-06-10T23:59:00Z');
    expect(contractCountdown(at('2026-06-18'), lateNow).daysUntil).toBe(8);
  });
});
