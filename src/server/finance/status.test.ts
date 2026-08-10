import { describe, it, expect } from 'vitest';
import {
  deriveSettlementState,
  deriveTemporalState,
  deriveChargeState,
  daysLate,
  remainingDueMinor,
} from './status';

const due = new Date('2026-06-01');
const before = new Date('2026-05-20');
const after = new Date('2026-06-15');

describe('deriveSettlementState (never stored)', () => {
  it('SETTLED / PARTIAL / UNSETTLED by amount vs allocations', () => {
    expect(deriveSettlementState(65000, 65000)).toBe('SETTLED');
    expect(deriveSettlementState(65000, 70000)).toBe('SETTLED');
    expect(deriveSettlementState(65000, 30000)).toBe('PARTIAL');
    expect(deriveSettlementState(65000, 0)).toBe('UNSETTLED');
  });
  it('throws on non-integer centimes', () => {
    expect(() => deriveSettlementState(650.5, 0)).toThrow(TypeError);
  });
});

describe('deriveTemporalState (independent axis)', () => {
  it('UPCOMING / DUE / OVERDUE by now vs dueDate', () => {
    expect(deriveTemporalState(due, before)).toBe('UPCOMING');
    expect(deriveTemporalState(due, due)).toBe('DUE');
    expect(deriveTemporalState(due, after)).toBe('OVERDUE');
  });
});

describe('deriveChargeState — the two axes are independent', () => {
  it('a partial + overdue charge is BOTH PARTIAL and OVERDUE', () => {
    expect(
      deriveChargeState({ amountMinor: 65000, allocatedMinor: 30000, dueDate: due, now: after }),
    ).toEqual({
      settlement: 'PARTIAL',
      temporal: 'OVERDUE',
    });
  });
  it('an unsettled but not-yet-due charge is UNSETTLED + UPCOMING (not "late")', () => {
    expect(
      deriveChargeState({ amountMinor: 65000, allocatedMinor: 0, dueDate: due, now: before }),
    ).toEqual({
      settlement: 'UNSETTLED',
      temporal: 'UPCOMING',
    });
  });
});

describe('daysLate / remainingDueMinor', () => {
  it('daysLate is 0 before due and positive after', () => {
    expect(daysLate(due, before)).toBe(0);
    expect(daysLate(due, new Date('2026-06-04'))).toBe(3);
  });
  it('remainingDueMinor never negative', () => {
    expect(remainingDueMinor(65000, 30000)).toBe(35000);
    expect(remainingDueMinor(65000, 70000)).toBe(0);
  });
});
