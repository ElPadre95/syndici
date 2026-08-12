import { describe, it, expect } from 'vitest';
import { normalizePhoneForWa, whatsappHref } from './whatsapp';

describe('whatsapp helpers', () => {
  it('normalizes a phone to digits only', () => {
    expect(normalizePhoneForWa('+212 6 12 34 56 78')).toBe('212612345678');
    expect(normalizePhoneForWa(null)).toBe('');
    expect(normalizePhoneForWa('')).toBe('');
  });

  it('builds a wa.me link with the message encoded', () => {
    const href = whatsappHref('+212 6 12 34 56 78', 'Bonjour Sara, code : K7QM');
    expect(href).toBe('https://wa.me/212612345678?text=Bonjour%20Sara%2C%20code%20%3A%20K7QM');
  });

  it('falls back to a share link when no phone is available', () => {
    expect(whatsappHref(null, 'coucou')).toBe('https://wa.me/?text=coucou');
  });
});
