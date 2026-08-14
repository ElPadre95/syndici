/**
 * Organisation du cabinet (F4). Résout l'organisation active (celle qui détient le mandat
 * actif de la résidence courante ET dont la personne est membre actif) et liste ses
 * membres. Les identités passent par la couche person-access (`listOrgMembers`).
 */
import type { SqlExecutor } from '@/server/db/sql';
import type { ActiveContext } from '@/server/auth/context';
import { listOrgMembers, type OrgMemberView } from '@/server/auth/person-access';

/**
 * Organisation active pour (personne, résidence) : membre ACTIF d'une organisation qui
 * détient un mandat ACTIF sur cette résidence. `null` si aucune.
 */
export async function getActiveOrganizationId(
  exec: SqlExecutor,
  personId: string,
  residenceId: string,
): Promise<string | null> {
  const rows = await exec.query<{ organizationId: string }>(
    `SELECT m."organizationId"
       FROM "Membership" m
       JOIN "Mandate" md ON md."organizationId" = m."organizationId"
      WHERE m."personId" = $1
        AND m.status = 'ACTIVE'
        AND md."residenceId" = $2
        AND md.status = 'ACTIVE'
        AND (md."endDate" IS NULL OR md."endDate" >= CURRENT_DATE)
      LIMIT 1`,
    [personId, residenceId],
  );
  return rows[0]?.organizationId ?? null;
}

export interface OrgMembers {
  organizationId: string;
  members: OrgMemberView[];
}

/** Membres du cabinet de la personne courante, ou `null` si aucune organisation active. */
export async function listMembers(
  exec: SqlExecutor,
  ctx: ActiveContext,
): Promise<OrgMembers | null> {
  const organizationId = await getActiveOrganizationId(exec, ctx.personId, ctx.residenceId);
  if (!organizationId) return null;
  const members = await listOrgMembers(exec, organizationId);
  return { organizationId, members };
}
