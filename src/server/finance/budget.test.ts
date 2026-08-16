/**
 * Budget prévisionnel vs réalisé (I2) — cœur PUR. La fusion budget/réalisé par catégorie,
 * l'écart signé (budget − réalisé), l'ordre et les totaux. Sans DB.
 */
import { describe, it, expect } from 'vitest';
import { computeBudgetVsActual } from './budget';

describe('computeBudgetVsActual (pur)', () => {
  it('fusionne budget et réalisé par catégorie ; écart = budget − réalisé', () => {
    const r = computeBudgetVsActual(
      2026,
      [
        { categoryId: 'c1', label: 'Nettoyage', budgetedMinor: 40000 },
        { categoryId: 'c2', label: 'Électricité', budgetedMinor: 24000 },
      ],
      [
        { categoryId: 'c1', label: 'Nettoyage', totalMinor: 32000 },
        { categoryId: 'c2', label: 'Électricité', totalMinor: 30000 },
      ],
    );
    const byId = new Map(r.lines.map((l) => [l.categoryId, l]));
    expect(byId.get('c1')!.ecartMinor).toBe(8000); // sous le budget
    expect(byId.get('c2')!.ecartMinor).toBe(-6000); // dépassé
    expect(r.totalBudgetedMinor).toBe(64000);
    expect(r.totalRealizedMinor).toBe(62000);
    expect(r.totalEcartMinor).toBe(2000);
  });

  it('une catégorie réalisée mais non budgétée apparaît (budget 0, écart négatif)', () => {
    const r = computeBudgetVsActual(
      2026,
      [{ categoryId: 'c1', label: 'Nettoyage', budgetedMinor: 40000 }],
      [{ categoryId: 'c9', label: 'Imprévu', totalMinor: 5000 }],
    );
    const surprise = r.lines.find((l) => l.categoryId === 'c9')!;
    expect(surprise.budgetedMinor).toBe(0);
    expect(surprise.realizedMinor).toBe(5000);
    expect(surprise.ecartMinor).toBe(-5000);
  });

  it('une catégorie budgétée mais non réalisée : réalisé 0, écart = budget', () => {
    const r = computeBudgetVsActual(
      2026,
      [{ categoryId: 'c1', label: 'Ravalement', budgetedMinor: 100000 }],
      [],
    );
    expect(r.lines[0]!.realizedMinor).toBe(0);
    expect(r.lines[0]!.ecartMinor).toBe(100000);
    expect(r.totalRealizedMinor).toBe(0);
  });

  it('trie par budget décroissant puis libellé', () => {
    const r = computeBudgetVsActual(
      2026,
      [
        { categoryId: 'a', label: 'Alpha', budgetedMinor: 10000 },
        { categoryId: 'b', label: 'Bravo', budgetedMinor: 30000 },
        { categoryId: 'c', label: 'Charlie', budgetedMinor: 10000 },
      ],
      [],
    );
    expect(r.lines.map((l) => l.categoryId)).toEqual(['b', 'a', 'c']);
  });

  it('catégorie sans id (null) supportée', () => {
    const r = computeBudgetVsActual(
      2026,
      [{ categoryId: null, label: 'Sans catégorie', budgetedMinor: 5000 }],
      [{ categoryId: null, label: 'Sans catégorie', totalMinor: 2000 }],
    );
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]!.ecartMinor).toBe(3000);
  });
});
