/**
 * Contexte multi-résidences (§4).
 *
 * Une même personne peut être SYNDIC/GESTIONNAIRE dans les résidences sous mandat
 * actif de son organisation, PROPRIÉTAIRE dans une résidence et LOCATAIRE dans une
 * autre (le cas MRE central). Le rôle applicatif n'est donc PAS une propriété de la
 * personne : il est TOUJOURS dérivé pour une (personId, residenceId) donnée, et
 * borné par un chemin d'accès valide au moment T :
 *   - staff : Membership ACTIF + Mandate ACTIF non expiré de l'organisation ;
 *   - résident : LotAttachment courant (endDate NULL) dans la résidence.
 *
 * Un mandat expiré retire l'accès (sans rien supprimer de l'historique) : le
 * prédicat `endDate >= CURRENT_DATE` en est le seul garant.
 */
import type { AppRole } from './permissions';
import type { SqlExecutor } from '@/server/db/sql';

/** Rôle d'organisation (OrgRole) → rôle applicatif staff. */
function mapStaffRole(orgRole: string): AppRole {
  return orgRole === 'OWNER_ADMIN' ? 'SYNDIC' : 'GESTIONNAIRE';
}

/** Le contexte actif : à qui, dans quelle résidence, avec quel rôle effectif. */
export interface ActiveContext {
  personId: string;
  residenceId: string;
  role: AppRole;
}

/**
 * Rôle effectif d'une personne DANS une résidence, ou `null` si aucun chemin
 * d'accès valide. Le staff prime sur le résident (un employé du cabinet qui
 * posséderait aussi un lot reste SYNDIC/GESTIONNAIRE) ; OWNER prime sur TENANT.
 */
export async function getResidenceRole(
  exec: SqlExecutor,
  personId: string,
  residenceId: string,
): Promise<AppRole | null> {
  const staff = await exec.query<{ role: string }>(
    `SELECT mem.role
       FROM "Membership" mem
       JOIN "Mandate" md ON md."organizationId" = mem."organizationId"
      WHERE mem."personId" = $1
        AND mem.status = 'ACTIVE'
        AND md."residenceId" = $2
        AND md.status = 'ACTIVE'
        AND (md."endDate" IS NULL OR md."endDate" >= CURRENT_DATE)
      ORDER BY (mem.role = 'OWNER_ADMIN') DESC
      LIMIT 1`,
    [personId, residenceId],
  );
  if (staff[0]) return mapStaffRole(staff[0].role);

  const resident = await exec.query<{ role: string }>(
    `SELECT role
       FROM "LotAttachment"
      WHERE "personId" = $1
        AND "residenceId" = $2
        AND "endDate" IS NULL
      ORDER BY (role = 'OWNER') DESC
      LIMIT 1`,
    [personId, residenceId],
  );
  if (resident[0]) return resident[0].role === 'OWNER' ? 'PROPRIETAIRE' : 'LOCATAIRE';

  return null;
}

/** Résidences auxquelles la personne a accès aujourd'hui (pour le sélecteur de contexte). */
export async function listAccessibleResidences(
  exec: SqlExecutor,
  personId: string,
): Promise<string[]> {
  const rows = await exec.query<{ residenceId: string }>(
    `SELECT md."residenceId" AS "residenceId"
       FROM "Membership" mem
       JOIN "Mandate" md ON md."organizationId" = mem."organizationId"
      WHERE mem."personId" = $1
        AND mem.status = 'ACTIVE'
        AND md.status = 'ACTIVE'
        AND (md."endDate" IS NULL OR md."endDate" >= CURRENT_DATE)
      UNION
     SELECT "residenceId" AS "residenceId"
       FROM "LotAttachment"
      WHERE "personId" = $1
        AND "endDate" IS NULL`,
    [personId],
  );
  return [...new Set(rows.map((r) => r.residenceId))];
}

/**
 * Résout le contexte actif demandé, en le REVALIDANT côté serveur. On ne fait
 * jamais confiance au `residenceId` stocké en session : s'il n'existe plus de
 * chemin d'accès (mandat expiré, rattachement clos), on renvoie `null` et l'accès
 * tombe. C'est le point d'entrée unique du scoping des requêtes.
 */
export async function resolveActiveContext(
  exec: SqlExecutor,
  personId: string,
  residenceId: string,
): Promise<ActiveContext | null> {
  const role = await getResidenceRole(exec, personId, residenceId);
  return role ? { personId, residenceId, role } : null;
}
