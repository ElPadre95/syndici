import { describe, it, expect } from 'vitest';
import { validateResidenceInput, type ResidenceFormRaw } from './validation';

const base: ResidenceFormRaw = {
  name: 'Résidence Test',
  address: 'Rue X',
  city: 'Casablanca',
  type: 'IMMEUBLE',
  unitsCount: '12',
  chargeAppt: '650',
  chargeVilla: '',
  dueDay: '1',
};

describe('validateResidenceInput (A2)', () => {
  it('accepts a valid immeuble and converts charges to centimes', () => {
    const r = validateResidenceInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({
        name: 'Résidence Test',
        city: 'Casablanca',
        type: 'IMMEUBLE',
        defaultUnitsCount: 12,
        defaultChargeApptMinor: 65000,
        defaultChargeVillaMinor: 0,
        dueDayOfMonth: 1,
      });
    }
  });

  it('requires both charges in mixte mode', () => {
    const r = validateResidenceInput({ ...base, type: 'MIXTE', chargeVilla: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.chargeVilla).toBe('amountInvalid');
  });

  it('requires only the villa charge in villa mode', () => {
    const r = validateResidenceInput({
      ...base,
      type: 'VILLA',
      chargeAppt: '',
      chargeVilla: '900',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.defaultChargeVillaMinor).toBe(90000);
      expect(r.value.defaultChargeApptMinor).toBe(0);
    }
  });

  it('reports per-field errors: name, city, units, dueDay', () => {
    const r = validateResidenceInput({
      ...base,
      name: '  ',
      city: '',
      unitsCount: '0',
      dueDay: '31',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toMatchObject({
        name: 'required',
        city: 'required',
        unitsCount: 'min1',
        dueDay: 'dueDayRange',
      });
    }
  });

  it('rejects a non-integer unit count and a bad amount', () => {
    const r = validateResidenceInput({ ...base, unitsCount: '3.5', chargeAppt: 'abc' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.unitsCount).toBe('min1');
      expect(r.errors.chargeAppt).toBe('amountInvalid');
    }
  });

  it('accepts a decimal amount with comma or dot', () => {
    const dot = validateResidenceInput({ ...base, chargeAppt: '650.50' });
    const comma = validateResidenceInput({ ...base, chargeAppt: '650,50' });
    expect(dot.ok && dot.value.defaultChargeApptMinor).toBe(65050);
    expect(comma.ok && comma.value.defaultChargeApptMinor).toBe(65050);
  });
});
