/**
 * Chantiers (I7) — cœur PUR de la comparaison des devis. Marque le moins-disant (unique,
 * premier en cas d'égalité) et le devis retenu. Sans DB.
 */
import { describe, it, expect } from 'vitest';
import { annotateQuotes } from './data';

describe('annotateQuotes (pur)', () => {
  const quotes = [
    { id: 'a', amountMinor: 52000 },
    { id: 'b', amountMinor: 48000 },
    { id: 'c', amountMinor: 61000 },
  ];

  it('marque le moins-disant', () => {
    const marks = annotateQuotes(quotes, null);
    expect(marks.find((m) => m.id === 'b')!.cheapest).toBe(true);
    expect(marks.filter((m) => m.cheapest)).toHaveLength(1);
  });

  it('marque le devis retenu, indépendamment du moins-disant', () => {
    const marks = annotateQuotes(quotes, 'a');
    const a = marks.find((m) => m.id === 'a')!;
    expect(a.selected).toBe(true);
    expect(a.cheapest).toBe(false); // a n'est pas le moins-disant
    expect(marks.find((m) => m.id === 'b')!.cheapest).toBe(true);
  });

  it('égalité de prix → un seul moins-disant (le premier)', () => {
    const marks = annotateQuotes(
      [
        { id: 'x', amountMinor: 30000 },
        { id: 'y', amountMinor: 30000 },
      ],
      null,
    );
    expect(marks.find((m) => m.id === 'x')!.cheapest).toBe(true);
    expect(marks.find((m) => m.id === 'y')!.cheapest).toBe(false);
  });

  it('aucun devis → aucune annotation', () => {
    expect(annotateQuotes([], null)).toEqual([]);
  });
});
