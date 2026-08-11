import { describe, it, expect } from 'vitest';
import { distributeQuoteParts } from './quote-part';

describe('distributeQuoteParts', () => {
  it('sums exactly to 1000 and gives the remainder to the first lots', () => {
    const q = distributeQuoteParts(24);
    expect(q).toHaveLength(24);
    expect(q.reduce((a, b) => a + b, 0)).toBe(1000);
    // 1000 / 24 = 41 r16 → 16 premiers à 42, le reste à 41
    expect(q.slice(0, 16).every((n) => n === 42)).toBe(true);
    expect(q.slice(16).every((n) => n === 41)).toBe(true);
  });

  it('handles even divisions', () => {
    expect(distributeQuoteParts(4)).toEqual([250, 250, 250, 250]);
    expect(distributeQuoteParts(1)).toEqual([1000]);
  });

  it('handles the remainder distribution', () => {
    expect(distributeQuoteParts(3)).toEqual([334, 333, 333]);
  });

  it('returns [] for non-positive counts', () => {
    expect(distributeQuoteParts(0)).toEqual([]);
    expect(distributeQuoteParts(-2)).toEqual([]);
  });
});
