/**
 * Répartition par catégorie (C2) — cœur PUR. Regroupe, somme en NET (une annulation
 * réduit son poste), omet les postes nuls, trie par montant décroissant, et range les
 * dépenses sans catégorie dans un poste dédié.
 */
import { describe, it, expect } from 'vitest';
import { aggregateByCategory } from './expenses';

const item = (categoryId: string | null, categoryLabel: string | null, amountMinor: number) => ({
  categoryId,
  categoryLabel,
  amountMinor,
});

describe('aggregateByCategory', () => {
  it('regroupe, somme et trie par montant décroissant', () => {
    const b = aggregateByCategory(
      [
        item('c1', 'Nettoyage', 3200_00),
        item('c2', 'Électricité', 1840_00),
        item('c1', 'Nettoyage', 800_00),
      ],
      'Sans catégorie',
    );
    expect(b.rows).toEqual([
      { categoryId: 'c1', label: 'Nettoyage', totalMinor: 4000_00 },
      { categoryId: 'c2', label: 'Électricité', totalMinor: 1840_00 },
    ]);
    expect(b.totalMinor).toBe(5840_00);
  });

  it('nette une annulation (négative) et omet un poste soldé à zéro', () => {
    const b = aggregateByCategory(
      [item('c1', 'Assurance', 1000_00), item('c1', 'Assurance', -1000_00)],
      'Sans catégorie',
    );
    expect(b.rows).toEqual([]); // poste net nul → omis
    expect(b.totalMinor).toBe(0);
  });

  it('range les dépenses sans catégorie dans le poste dédié', () => {
    const b = aggregateByCategory([item(null, null, 500_00)], 'Sans catégorie');
    expect(b.rows).toEqual([{ categoryId: null, label: 'Sans catégorie', totalMinor: 500_00 }]);
  });
});
