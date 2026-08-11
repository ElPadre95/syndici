import { describe, it, expect } from 'vitest';
import { generateGroup, planGeneration, type GroupSpec } from './generation';

describe('generateGroup', () => {
  it('continuous scheme: prefix + sequential numbers', () => {
    const refs = generateGroup({ type: 'VILLA', count: 3, scheme: 'continuous', prefix: 'V' });
    expect(refs.map((r) => r.reference)).toEqual(['V1', 'V2', 'V3']);
    expect(refs.every((r) => r.type === 'VILLA' && r.floor === null)).toBe(true);
  });

  it('floor scheme: one letter per floor, units within (A1, A2, B1, B2…)', () => {
    const refs = generateGroup({
      type: 'APPARTEMENT',
      count: 6,
      scheme: 'floor',
      prefix: '',
      floors: 3,
    });
    expect(refs.map((r) => r.reference)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    expect(refs[0]).toMatchObject({ floor: 'A' });
  });

  it('floor scheme with uneven split stops exactly at count', () => {
    const refs = generateGroup({
      type: 'APPARTEMENT',
      count: 5,
      scheme: 'floor',
      prefix: '',
      floors: 2,
    });
    // perFloor = ceil(5/2) = 3 → A1,A2,A3,B1,B2
    expect(refs.map((r) => r.reference)).toEqual(['A1', 'A2', 'A3', 'B1', 'B2']);
  });

  it('rejects invalid params', () => {
    expect(() =>
      generateGroup({ type: 'VILLA', count: -1, scheme: 'continuous', prefix: '' }),
    ).toThrow();
    expect(() =>
      generateGroup({ type: 'VILLA', count: 4, scheme: 'floor', prefix: '', floors: 0 }),
    ).toThrow();
  });
});

describe('planGeneration', () => {
  const mixte: GroupSpec[] = [
    { type: 'APPARTEMENT', count: 4, scheme: 'floor', prefix: '', floors: 2 }, // A1,A2,B1,B2
    { type: 'VILLA', count: 2, scheme: 'continuous', prefix: 'V' }, // V1,V2
  ];

  it('plans a mixte set with distinct prefixes', () => {
    const plan = planGeneration(mixte, []);
    expect(plan.toCreate.map((l) => l.reference)).toEqual(['A1', 'A2', 'B1', 'B2', 'V1', 'V2']);
    expect(plan.conflicts).toEqual([]);
  });

  it('never overwrites: existing references become conflicts', () => {
    const plan = planGeneration(mixte, ['A1', 'V1']);
    expect(plan.conflicts.sort()).toEqual(['A1', 'V1']);
    expect(plan.toCreate.map((l) => l.reference)).toEqual(['A2', 'B1', 'B2', 'V2']);
  });

  it('is idempotent: regenerating an existing set creates nothing', () => {
    const first = planGeneration(mixte, []);
    const existing = first.toCreate.map((l) => l.reference);
    const second = planGeneration(mixte, existing);
    expect(second.toCreate).toEqual([]);
    expect(second.conflicts).toHaveLength(existing.length);
  });

  it('detects duplicates within the request itself', () => {
    const dup: GroupSpec[] = [
      { type: 'APPARTEMENT', count: 2, scheme: 'continuous', prefix: 'X' }, // X1,X2
      { type: 'VILLA', count: 2, scheme: 'continuous', prefix: 'X' }, // X1,X2 → collide
    ];
    const plan = planGeneration(dup, []);
    expect(plan.duplicatesWithin).toEqual(['X1', 'X2']);
    expect(plan.toCreate.map((l) => l.reference)).toEqual(['X1', 'X2']); // one instance each
  });
});
