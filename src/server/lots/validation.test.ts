import { describe, it, expect } from 'vitest';
import {
  validateLotInput,
  validateGenerationInput,
  type LotFormRaw,
  type GroupRaw,
} from './validation';

const baseLot: LotFormRaw = {
  reference: 'B3',
  type: 'APPARTEMENT',
  floor: '2',
  surfaceM2: '78',
  quotePart: '42',
  charge: '',
};

describe('validateLotInput', () => {
  it('accepts a valid lot; empty charge inherits residence default (null)', () => {
    const r = validateLotInput(baseLot);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({
        reference: 'B3',
        type: 'APPARTEMENT',
        floor: '2',
        surfaceM2: 78,
        quotePart: 42,
        monthlyChargeMinor: null,
      });
    }
  });

  it('parses an explicit charge into centimes', () => {
    const r = validateLotInput({ ...baseLot, charge: '650,50' });
    expect(r.ok && r.value.monthlyChargeMinor).toBe(65050);
  });

  it('reports per-field errors', () => {
    const r = validateLotInput({
      ...baseLot,
      reference: '  ',
      type: 'HOUSE',
      surfaceM2: '-3',
      quotePart: '1.5',
      charge: 'abc',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toMatchObject({
        reference: 'required',
        type: 'invalidType',
        surfaceM2: 'invalidSurface',
        quotePart: 'invalidQuote',
        charge: 'amountInvalid',
      });
    }
  });
});

describe('validateGenerationInput', () => {
  const grp = (o: Partial<GroupRaw>): GroupRaw => ({
    type: 'APPARTEMENT',
    count: '4',
    scheme: 'continuous',
    prefix: '',
    floors: '',
    ...o,
  });

  it('normalizes a mixte spec and drops empty groups', () => {
    const r = validateGenerationInput([
      grp({ type: 'APPARTEMENT', count: '18', scheme: 'floor', floors: '3' }),
      grp({ type: 'VILLA', count: '6', scheme: 'continuous', prefix: 'V' }),
      grp({ type: 'VILLA', count: '0' }), // ignoré
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.groups).toHaveLength(2);
      expect(r.groups[0]).toMatchObject({ type: 'APPARTEMENT', count: 18, floors: 3 });
    }
  });

  it('errors when everything is empty', () => {
    const r = validateGenerationInput([grp({ count: '0' })]);
    expect(r).toEqual({ ok: false, error: 'noGroups' });
  });

  it('errors on invalid floors for the floor scheme', () => {
    const r = validateGenerationInput([grp({ scheme: 'floor', floors: '0' })]);
    expect(r).toEqual({ ok: false, error: 'invalidFloors' });
  });

  it('errors on a non-integer count', () => {
    const r = validateGenerationInput([grp({ count: '3.5' })]);
    expect(r).toEqual({ ok: false, error: 'invalidCount' });
  });
});
