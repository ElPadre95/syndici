/**
 * Membres du cabinet (F4) — cœur PUR du verrou « dernier administrateur ». Un cabinet
 * doit toujours garder au moins UN administrateur actif : on ne peut ni retirer ni
 * rétrograder le dernier `OWNER_ADMIN` actif (sinon le compte devient ingérable).
 */
export type OrgRole = 'OWNER_ADMIN' | 'MANAGER' | 'STAFF';
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'ENDED';

/** Rôles proposés à l'invitation / au changement (F4) : administrateur ou gestionnaire. */
export const ASSIGNABLE_ORG_ROLES: readonly OrgRole[] = ['OWNER_ADMIN', 'MANAGER'];

export interface MemberRoleStatus {
  membershipId: string;
  role: string;
  status: string;
}

function isActiveAdmin(m: MemberRoleStatus): boolean {
  return m.status === 'ACTIVE' && m.role === 'OWNER_ADMIN';
}

/**
 * Ce membre est-il le DERNIER administrateur actif ? Si oui, le retirer ou le rétrograder
 * laisserait le cabinet sans administrateur — interdit. Retirer/rétrograder un non-admin,
 * ou un admin alors qu'il en reste d'autres, est permis.
 */
export function isLastActiveAdmin(
  members: MemberRoleStatus[],
  targetMembershipId: string,
): boolean {
  const target = members.find((m) => m.membershipId === targetMembershipId);
  if (!target || !isActiveAdmin(target)) return false;
  return members.filter(isActiveAdmin).length <= 1;
}
