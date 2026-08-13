import { describe, it, expect } from 'vitest';
import { defaultExpenseCategories } from './categories';

describe('defaultExpenseCategories (SPEC §7.3)', () => {
  it('immeuble : 8 postes', () => {
    const c = defaultExpenseCategories('IMMEUBLE');
    expect(c).toHaveLength(8);
    expect(c).toContain('Ascenseur');
    expect(c).not.toContain('Piscine commune');
  });

  it('villa / lotissement : 10 postes', () => {
    const c = defaultExpenseCategories('VILLA');
    expect(c).toHaveLength(10);
    expect(c).toContain('Piscine commune');
    expect(c).not.toContain('Ascenseur');
  });

  it('mixte : union sans doublons (Maintenance/Assurance/Autre communs)', () => {
    const c = defaultExpenseCategories('MIXTE');
    expect(new Set(c).size).toBe(c.length); // pas de doublon
    expect(c).toContain('Ascenseur');
    expect(c).toContain('Piscine commune');
    expect(c.filter((x) => x === 'Maintenance')).toHaveLength(1);
    expect(c).toHaveLength(8 + 10 - 3); // 3 communs
  });
});
