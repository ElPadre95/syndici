import { describe, it, expect } from 'vitest';
import { daysUntilDeadline, contractAlert } from './deadline';

const now = new Date('2026-06-10'); // date RÉELLE (le prototype la figeait — anomalie M1)

describe('contract deadline countdown (SPEC §7.2, against the real date)', () => {
  it('counts days until the deadline', () => {
    expect(daysUntilDeadline(new Date('2026-06-20'), now)).toBe(10);
    expect(daysUntilDeadline(new Date('2026-06-05'), now)).toBe(-5);
  });

  it('classifies alerts: <0 EXPIRED, <=30 SOON, else OK', () => {
    expect(contractAlert(-1)).toBe('EXPIRED');
    expect(contractAlert(0)).toBe('SOON');
    expect(contractAlert(30)).toBe('SOON');
    expect(contractAlert(31)).toBe('OK');
  });
});
