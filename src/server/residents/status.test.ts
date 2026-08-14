/**
 * Annuaire (F2) — dérivation PURE de l'état de compte. Le compte activé prime sur
 * une invitation en attente ; sans compte ni invitation, la personne n'a jamais été invitée.
 */
import { describe, it, expect } from 'vitest';
import { residentAccountStatus } from './status';

describe('residentAccountStatus', () => {
  it('un compte activé prime, même avec une invitation en attente', () => {
    expect(residentAccountStatus(true, false)).toBe('ACTIVE');
    expect(residentAccountStatus(true, true)).toBe('ACTIVE');
  });
  it('sans compte mais avec invitation en attente : PENDING', () => {
    expect(residentAccountStatus(false, true)).toBe('PENDING');
  });
  it('ni compte ni invitation : jamais invité', () => {
    expect(residentAccountStatus(false, false)).toBe('NEVER');
  });
});
