/**
 * Régularisation annuelle (I3) — cœur PUR. Répartition exacte de la quote-part réelle aux
 * tantièmes, écart par lot (quote-part − provisions) et invariant global. Sans DB.
 */
import { describe, it, expect } from 'vitest';
import { computeRegularisation } from './regularisation';

const lots = [
  { lotId: 'a', reference: 'A1', quotePart: 1, provisionsMinor: 30000 },
  { lotId: 'b', reference: 'A2', quotePart: 1, provisionsMinor: 20000 },
  { lotId: 'c', reference: 'A10', quotePart: 2, provisionsMinor: 40000 },
];

describe('computeRegularisation (pur)', () => {
  it('répartit la quote-part réelle aux tantièmes, somme EXACTE = dépenses', () => {
    const r = computeRegularisation(2026, 100000, lots);
    const sumShare = r.lines.reduce((s, l) => s + l.quotePartMinor, 0);
    expect(sumShare).toBe(100000); // aucun centime perdu ni créé
    // quotes-parts 1/1/2 sur 4 → 25000 / 25000 / 50000
    const byId = new Map(r.lines.map((l) => [l.lotId, l]));
    expect(byId.get('a')!.quotePartMinor).toBe(25000);
    expect(byId.get('c')!.quotePartMinor).toBe(50000);
  });

  it('écart = quote-part − provisions ; positif = supplément, négatif = avoir', () => {
    const r = computeRegularisation(2026, 100000, lots);
    const byId = new Map(r.lines.map((l) => [l.lotId, l]));
    expect(byId.get('a')!.adjustmentMinor).toBe(25000 - 30000); // -5000 avoir
    expect(byId.get('c')!.adjustmentMinor).toBe(50000 - 40000); // +10000 supplément
  });

  it('invariant : écart global = dépenses − provisions', () => {
    const r = computeRegularisation(2026, 100000, lots);
    expect(r.totalProvisionsMinor).toBe(90000);
    expect(r.totalExpensesMinor).toBe(100000);
    expect(r.totalAdjustmentMinor).toBe(100000 - 90000);
    // et la somme des écarts par lot égale bien l'écart global
    expect(r.lines.reduce((s, l) => s + l.adjustmentMinor, 0)).toBe(r.totalAdjustmentMinor);
  });

  it('trie par référence de lot (numérique : A2 avant A10)', () => {
    const r = computeRegularisation(2026, 100000, lots);
    expect(r.lines.map((l) => l.reference)).toEqual(['A1', 'A2', 'A10']);
  });

  it('aucune dépense → quote-part nulle, écart = −provisions (tout en avoir)', () => {
    const r = computeRegularisation(2026, 0, lots);
    expect(r.totalExpensesMinor).toBe(0);
    expect(r.lines.every((l) => l.quotePartMinor === 0)).toBe(true);
    expect(r.totalAdjustmentMinor).toBe(-90000);
  });

  it('quote-part nulle sur un lot → il ne reçoit aucune part', () => {
    const r = computeRegularisation(2026, 90000, [
      { lotId: 'x', reference: 'X1', quotePart: 0, provisionsMinor: 10000 },
      { lotId: 'y', reference: 'Y1', quotePart: 3, provisionsMinor: 0 },
    ]);
    const byId = new Map(r.lines.map((l) => [l.lotId, l]));
    expect(byId.get('x')!.quotePartMinor).toBe(0);
    expect(byId.get('y')!.quotePartMinor).toBe(90000);
  });
});
