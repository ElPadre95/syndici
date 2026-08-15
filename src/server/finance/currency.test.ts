/** Devise secondaire (H5) — conversion indicative, cœur PUR. */
import { describe, it, expect } from 'vitest';
import { convertMinor } from './currency';

describe('convertMinor', () => {
  it('convertit des centimes de dirham en unités de la devise (1 EUR = 10,75 MAD)', () => {
    // 650,00 MAD = 65000 centimes ; 1 EUR = 1075 centimes → ≈ 60,47 EUR.
    expect(convertMinor(65000, 1075)).toBeCloseTo(60.4651, 3);
  });
  it('taux nul ou négatif → 0 (jamais une division absurde)', () => {
    expect(convertMinor(65000, 0)).toBe(0);
    expect(convertMinor(65000, -5)).toBe(0);
  });
  it('montant nul → 0', () => {
    expect(convertMinor(0, 1075)).toBe(0);
  });
});
