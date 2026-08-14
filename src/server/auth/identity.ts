/**
 * Résolution de l'identité de session — le cœur du correctif du bug « coquille vide ».
 * ISOLÉ d'Auth.js et de `next/headers` (aucune dépendance runtime Next) pour être testé
 * directement contre PGlite ET Postgres réel.
 *
 * Distinction clé, jamais silencieuse :
 *   - `stale`  : `personId` absent ou pointant vers une personne QUI N'EXISTE PLUS
 *                (données de démo rechargées → nouveaux identifiants, compte non lié) ;
 *   - `active` : personne réelle. Ses résidences accessibles peuvent être VIDES (personne
 *                sans résidence = onboarding légitime, pas une panne) ; la résidence active
 *                est revalidée (un cookie hors périmètre ou pointant vers une résidence
 *                disparue est ignoré → repli sur une accessible ou `null`).
 */
import type { SqlExecutor } from '@/server/db/sql';
import type { AppRole } from './permissions';
import { getResidenceRole, listAccessibleResidences } from './context';
import { personExists } from './person-access';
import { resolveActiveResidenceId } from './active-residence';

export type IdentityResolution =
  | { status: 'stale' }
  | { status: 'active'; accessibleIds: string[]; activeId: string | null; role: AppRole | null };

export async function resolveIdentity(
  exec: SqlExecutor,
  personId: string | null | undefined,
  cookieValue: string | null | undefined,
): Promise<IdentityResolution> {
  if (!personId || !(await personExists(exec, personId))) return { status: 'stale' };

  const accessibleIds = await listAccessibleResidences(exec, personId);
  const activeId = resolveActiveResidenceId(accessibleIds, cookieValue);
  const role = activeId ? await getResidenceRole(exec, personId, activeId) : null;
  return { status: 'active', accessibleIds, activeId, role };
}
