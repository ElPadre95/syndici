/**
 * Espace propriétaire (G1) — cœurs PURS. Résumé des charges d'un lot (reste dû, prochaine
 * échéance, retard) et comptage collectif « à jour / en attente » (nombres seulement).
 */
import { describe, it, expect } from 'vitest';
import { summarizeCharges, countSettledLots, type OwnerCharge } from './owner';

const call = (o: Partial<OwnerCharge>): OwnerCharge => ({
  id: 'c',
  year: 2026,
  month: 6,
  dueDate: '2026-06-01T00:00:00.000Z',
  amountMinor: 65000,
  allocatedMinor: 0,
  remainingMinor: 65000,
  settlement: 'UNSETTLED',
  temporal: 'UPCOMING',
  daysLate: 0,
  ...o,
});

describe('summarizeCharges', () => {
  it('tout réglé : rien dû, aucune échéance, pas de retard', () => {
    const s = summarizeCharges([call({ settlement: 'SETTLED', remainingMinor: 0 })]);
    expect(s).toEqual({
      totalRemainingMinor: 0,
      nextDueDate: null,
      maxDaysLate: 0,
      overdue: false,
      settledAll: true,
    });
  });

  it('additionne le reste dû des appels non réglés', () => {
    const s = summarizeCharges([
      call({ remainingMinor: 65000 }),
      call({ settlement: 'PARTIAL', remainingMinor: 20000 }),
      call({ settlement: 'SETTLED', remainingMinor: 0 }),
    ]);
    expect(s.totalRemainingMinor).toBe(85000);
    expect(s.settledAll).toBe(false);
  });

  it('signale le retard et le nombre de jours max parmi les échus non réglés', () => {
    const s = summarizeCharges([
      call({ temporal: 'OVERDUE', daysLate: 12, remainingMinor: 65000 }),
      call({ temporal: 'OVERDUE', daysLate: 40, remainingMinor: 65000 }),
      call({ temporal: 'UPCOMING', daysLate: 0 }),
    ]);
    expect(s.overdue).toBe(true);
    expect(s.maxDaysLate).toBe(40);
  });

  it('prochaine échéance = la plus PROCHE parmi les non réglés', () => {
    const s = summarizeCharges([
      call({ dueDate: '2026-08-01T00:00:00.000Z' }),
      call({ dueDate: '2026-06-01T00:00:00.000Z' }),
      call({ dueDate: '2026-07-01T00:00:00.000Z', settlement: 'SETTLED', remainingMinor: 0 }),
    ]);
    expect(s.nextDueDate).toBe('2026-06-01T00:00:00.000Z');
  });
});

describe('countSettledLots', () => {
  it('compte à jour vs en attente', () => {
    const counts = countSettledLots([
      { amountMinor: 65000, allocatedMinor: 65000 }, // à jour
      { amountMinor: 65000, allocatedMinor: 30000 }, // partiel → en attente
      { amountMinor: 65000, allocatedMinor: 0 }, // impayé → en attente
    ]);
    expect(counts).toEqual({ paidCount: 1, pendingCount: 2, totalLots: 3 });
  });

  it('un versement excédentaire (plafonné) reste à jour', () => {
    const counts = countSettledLots([{ amountMinor: 65000, allocatedMinor: 70000 }]);
    expect(counts.paidCount).toBe(1);
  });

  it('aucun appel : tout à zéro', () => {
    expect(countSettledLots([])).toEqual({ paidCount: 0, pendingCount: 0, totalLots: 0 });
  });
});
