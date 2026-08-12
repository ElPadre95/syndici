import { describe, it, expect } from 'vitest';
import { validateAttachInput, type AttachFormRaw } from './attach-validation';

const base: AttachFormRaw = {
  existingPersonId: '',
  firstName: 'Sara',
  lastName: 'Tahiri',
  email: 'sara@example.fr',
  phone: '+33 6 12 34 56 78',
  nationality: 'France',
  preferredLocale: 'fr',
  role: 'OWNER',
  delegate: '',
  startDate: '2026-03-01',
};

describe('validateAttachInput (A5)', () => {
  it('accepts a new owner', () => {
    const r = validateAttachInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.existingPersonId).toBeNull();
      expect(r.value.person?.firstName).toBe('Sara');
      expect(r.value.role).toBe('OWNER');
      expect(r.value.delegate).toBe(false);
    }
  });

  it('accepts an existing person without requiring name fields (dédoublonnage MRE)', () => {
    const r = validateAttachInput({
      ...base,
      existingPersonId: 'person-123',
      firstName: '',
      lastName: '',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.existingPersonId).toBe('person-123');
      expect(r.value.person).toBeNull();
    }
  });

  it('délégation seulement pour un locataire', () => {
    const owner = validateAttachInput({ ...base, role: 'OWNER', delegate: 'on' });
    expect(owner.ok && owner.value.delegate).toBe(false);
    const tenant = validateAttachInput({ ...base, role: 'TENANT', delegate: 'on' });
    expect(tenant.ok && tenant.value.delegate).toBe(true);
  });

  it('reports field errors for a new person', () => {
    const r = validateAttachInput({
      ...base,
      firstName: ' ',
      lastName: '',
      email: 'not-an-email',
      preferredLocale: 'en',
      startDate: '',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toMatchObject({
        firstName: 'required',
        lastName: 'required',
        email: 'invalidEmail',
        preferredLocale: 'invalidLocale',
        startDate: 'required',
      });
    }
  });
});
