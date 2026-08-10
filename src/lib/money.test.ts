import { describe, it, expect } from 'vitest';
import { formatMoney, toCentimes, splitAmount, sumMoney, CURRENCY } from './money';

/** Normalize the various Unicode spaces Intl inserts so assertions are stable. */
const norm = (s: string) => s.replace(/[\u00a0\u202f\u2009\u200a]/g, ' ');

describe('formatMoney', () => {
  it('formats integer centimes as MAD with two decimals (fr)', () => {
    const out = norm(formatMoney(65000, 'fr'));
    expect(out).toContain('650');
    expect(out).toContain(',00'); // French decimal comma
    expect(out).toMatch(/MAD|درهم|DH/); // currency marker
  });

  it('formats zero', () => {
    const out = norm(formatMoney(0, 'fr'));
    expect(out).toContain('0,00');
  });

  it('formats negative amounts', () => {
    const out = norm(formatMoney(-65000, 'fr'));
    expect(out).toContain('650');
    expect(out).toMatch(/-|−/); // minus sign (hyphen or Unicode minus)
  });

  it('keeps two-decimal precision from centimes', () => {
    expect(norm(formatMoney(65050, 'fr'))).toContain('650,50');
    expect(norm(formatMoney(1, 'fr'))).toContain('0,01');
  });

  it('groups thousands', () => {
    const out = norm(formatMoney(123456789, 'fr')); // 1 234 567,89 MAD
    expect(out).toContain('234');
    expect(out).toContain(',89');
  });

  it('produces a different rendering for ar than fr (locale-aware)', () => {
    const fr = formatMoney(65000, 'fr');
    const ar = formatMoney(65000, 'ar');
    expect(ar).not.toEqual(fr);
  });

  it('falls back to fr for unknown locales', () => {
    expect(formatMoney(65000, 'xx')).toEqual(formatMoney(65000, 'fr'));
  });

  it('defaults to fr when no locale is given', () => {
    expect(formatMoney(65000)).toEqual(formatMoney(65000, 'fr'));
  });

  it('throws on non-integer (float) input — floats are forbidden', () => {
    expect(() => formatMoney(650.5, 'fr')).toThrow(TypeError);
    expect(() => formatMoney(0.1 + 0.2, 'fr')).toThrow(TypeError);
  });

  it('uses MAD as the currency', () => {
    expect(CURRENCY).toBe('MAD');
  });
});

describe('toCentimes', () => {
  it('converts major units to integer centimes', () => {
    expect(toCentimes(650)).toBe(65000);
    expect(toCentimes(650, 50)).toBe(65050);
    expect(toCentimes(0)).toBe(0);
  });

  it('rounds float major units to the nearest centime', () => {
    expect(toCentimes(19.99)).toBe(1999);
    expect(toCentimes(0.1 + 0.2)).toBe(30); // 0.30000000000000004 -> 30
  });

  it('always returns an integer accepted by formatMoney', () => {
    const c = toCentimes(1234.56);
    expect(Number.isInteger(c)).toBe(true);
    expect(() => formatMoney(c, 'fr')).not.toThrow();
  });
});

describe('splitAmount', () => {
  it('splits positive amounts', () => {
    expect(splitAmount(65050)).toEqual({ dirhams: 650, centimes: 50 });
  });

  it('splits negative amounts (sign on dirhams)', () => {
    expect(splitAmount(-65050)).toEqual({ dirhams: -650, centimes: 50 });
  });

  it('throws on floats', () => {
    expect(() => splitAmount(1.5)).toThrow(TypeError);
  });
});

describe('sumMoney', () => {
  it('sums a list of centimes', () => {
    expect(sumMoney([65000, 120000, 1])).toBe(185001);
  });

  it('returns 0 for an empty list', () => {
    expect(sumMoney([])).toBe(0);
  });

  it('throws if any element is a float', () => {
    expect(() => sumMoney([65000, 1.5])).toThrow(TypeError);
  });
});
