import { describe, it, expect } from 'vitest';
import { can, permissionsOf, type AppRole, type Permission } from './permissions';

describe('permissions matrix (§3) — single source of truth', () => {
  it('SYNDIC has full control incl. settings, deletion, member management', () => {
    for (const p of [
      'residence.settings',
      'residence.delete',
      'member.manage',
      'expense.manage',
      'owner.identity.view',
      'invitation.manage',
    ] as Permission[]) {
      expect(can('SYNDIC', p)).toBe(true);
    }
  });

  it('GESTIONNAIRE = SYNDIC minus settings, deletion, member management', () => {
    expect(can('GESTIONNAIRE', 'residence.settings')).toBe(false);
    expect(can('GESTIONNAIRE', 'residence.delete')).toBe(false);
    expect(can('GESTIONNAIRE', 'member.manage')).toBe(false);
    // but keeps operational rights
    expect(can('GESTIONNAIRE', 'expense.manage')).toBe(true);
    expect(can('GESTIONNAIRE', 'payment.record')).toBe(true);
    expect(can('GESTIONNAIRE', 'owner.identity.view')).toBe(true);
  });

  it('PROPRIETAIRE: own lots/charges, visible expenses, votes — not global nor member mgmt', () => {
    expect(can('PROPRIETAIRE', 'lot.view.own')).toBe(true);
    expect(can('PROPRIETAIRE', 'charge.view.own')).toBe(true);
    expect(can('PROPRIETAIRE', 'expense.view')).toBe(true);
    expect(can('PROPRIETAIRE', 'vote.cast')).toBe(true);
    expect(can('PROPRIETAIRE', 'incident.report')).toBe(true);
    // denied
    expect(can('PROPRIETAIRE', 'charge.view.all')).toBe(false);
    expect(can('PROPRIETAIRE', 'owner.identity.view')).toBe(false);
    expect(can('PROPRIETAIRE', 'member.manage')).toBe(false);
    expect(can('PROPRIETAIRE', 'expense.manage')).toBe(false);
  });

  it('LOCATAIRE: own lot, incidents, news — NOT expenses, NOT votes, NOT owner identity', () => {
    expect(can('LOCATAIRE', 'lot.view.own')).toBe(true);
    expect(can('LOCATAIRE', 'incident.report')).toBe(true);
    expect(can('LOCATAIRE', 'announcement.view')).toBe(true);
    // the three explicit denials
    expect(can('LOCATAIRE', 'expense.view')).toBe(false);
    expect(can('LOCATAIRE', 'vote.view')).toBe(false);
    expect(can('LOCATAIRE', 'vote.cast')).toBe(false);
    expect(can('LOCATAIRE', 'owner.identity.view')).toBe(false);
  });

  it('is deny-by-default (nothing granted leaks in)', () => {
    const roles: AppRole[] = ['SYNDIC', 'GESTIONNAIRE', 'PROPRIETAIRE', 'LOCATAIRE'];
    // Only SYNDIC may delete a residence.
    expect(roles.filter((r) => can(r, 'residence.delete'))).toEqual(['SYNDIC']);
    // owner.identity.view is staff-only.
    expect(roles.filter((r) => can(r, 'owner.identity.view'))).toEqual(['SYNDIC', 'GESTIONNAIRE']);
  });

  it('permissionsOf returns a stable sorted list', () => {
    const p = permissionsOf('LOCATAIRE');
    expect(p).toEqual([...p].sort());
    expect(p).toContain('lot.view.own');
    expect(p).not.toContain('expense.view');
  });
});
