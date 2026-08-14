/**
 * État de compte d'un résident dans l'annuaire (F2). Règle PURE et testable :
 *   - `ACTIVE`  : la personne a activé son compte (rattaché à un compte d'auth) ;
 *   - `PENDING` : pas encore de compte, mais une invitation est EN ATTENTE ;
 *   - `NEVER`   : jamais invité (aucune invitation en attente, aucun compte).
 * L'existence d'un compte prime : une personne activée reste ACTIVE même si une
 * vieille invitation traînait.
 */
export type ResidentAccountStatus = 'ACTIVE' | 'PENDING' | 'NEVER';

export function residentAccountStatus(
  hasAccount: boolean,
  hasPendingInvite: boolean,
): ResidentAccountStatus {
  if (hasAccount) return 'ACTIVE';
  if (hasPendingInvite) return 'PENDING';
  return 'NEVER';
}
