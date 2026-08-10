import { describe, it, expect } from 'vitest';
import {
  detectReminders,
  lateFeeApplies,
  DEFAULT_REMINDER_RULE,
  type ReminderCandidate,
} from './rule';

const now = new Date('2026-06-20');

describe('detectReminders — partials AND unsettled, overdue >= 3 days (SPEC §7.1)', () => {
  it('keeps PARTIAL and UNSETTLED with >= 3 days late, sorted by days late desc', () => {
    const cands: ReminderCandidate[] = [
      { lotId: 'A', settlement: 'UNSETTLED', daysLate: 8, lastReminderAt: null },
      { lotId: 'B', settlement: 'PARTIAL', daysLate: 5, lastReminderAt: null }, // partiel relancé comme un retard
      { lotId: 'C', settlement: 'UNSETTLED', daysLate: 2, lastReminderAt: null }, // < 3 -> excluded
      { lotId: 'D', settlement: 'SETTLED', daysLate: 9, lastReminderAt: null }, // soldé -> excluded
    ];
    expect(detectReminders(cands, DEFAULT_REMINDER_RULE, now).map((c) => c.lotId)).toEqual([
      'A',
      'B',
    ]);
  });

  it('anti-harassment: excludes anyone reminded less than 4 days ago', () => {
    const cands: ReminderCandidate[] = [
      { lotId: 'A', settlement: 'UNSETTLED', daysLate: 8, lastReminderAt: new Date('2026-06-18') }, // 2 j -> excluded
      { lotId: 'B', settlement: 'UNSETTLED', daysLate: 8, lastReminderAt: new Date('2026-06-10') }, // 10 j -> kept
    ];
    expect(detectReminders(cands, DEFAULT_REMINDER_RULE, now).map((c) => c.lotId)).toEqual(['B']);
  });

  it('respects a configured (versioned) rule', () => {
    const strict = { ...DEFAULT_REMINDER_RULE, overdueThresholdDays: 10 };
    const cands: ReminderCandidate[] = [
      { lotId: 'A', settlement: 'UNSETTLED', daysLate: 8, lastReminderAt: null },
    ];
    expect(detectReminders(cands, strict, now)).toHaveLength(0);
  });

  it('late fee threshold is 10 days', () => {
    expect(lateFeeApplies(9)).toBe(false);
    expect(lateFeeApplies(10)).toBe(true);
  });
});
