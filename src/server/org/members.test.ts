/**
 * Membres (F4) — verrou « dernier administrateur », cœur pur. C'est le garde-fou qui
 * empêche de rendre un cabinet ingérable en retirant/rétrogradant son seul admin.
 */
import { describe, it, expect } from 'vitest';
import { isLastActiveAdmin, type MemberRoleStatus } from './members';

const admin = (id: string, status = 'ACTIVE'): MemberRoleStatus => ({
  membershipId: id,
  role: 'OWNER_ADMIN',
  status,
});
const manager = (id: string, status = 'ACTIVE'): MemberRoleStatus => ({
  membershipId: id,
  role: 'MANAGER',
  status,
});

describe('isLastActiveAdmin', () => {
  it('le seul admin actif est protégé (retrait/rétrogradation interdits)', () => {
    const members = [admin('a1'), manager('m1')];
    expect(isLastActiveAdmin(members, 'a1')).toBe(true);
  });

  it('avec deux admins actifs, aucun n’est le dernier', () => {
    const members = [admin('a1'), admin('a2'), manager('m1')];
    expect(isLastActiveAdmin(members, 'a1')).toBe(false);
    expect(isLastActiveAdmin(members, 'a2')).toBe(false);
  });

  it('un gestionnaire n’est jamais « dernier admin »', () => {
    const members = [admin('a1'), manager('m1')];
    expect(isLastActiveAdmin(members, 'm1')).toBe(false);
  });

  it('un admin déjà retiré ne compte pas ; le dernier admin ACTIF reste protégé', () => {
    const members = [admin('a1'), admin('a2', 'ENDED')];
    expect(isLastActiveAdmin(members, 'a1')).toBe(true); // a2 retiré → a1 seul actif
    expect(isLastActiveAdmin(members, 'a2')).toBe(false); // a2 n'est pas actif
  });

  it('un id inconnu n’est pas protégé', () => {
    expect(isLastActiveAdmin([admin('a1')], 'zzz')).toBe(false);
  });
});
