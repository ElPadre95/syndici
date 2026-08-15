/**
 * MUR DES INCIDENTS (H1) — point de contrôle UNIQUE.
 *
 * Règle d'accès à un incident, appliquée ici et nulle part ailleurs (lectures, fil de
 * suivi, service de la photo) :
 *   - staff (SYNDIC/GESTIONNAIRE) : tout incident de sa résidence active ;
 *   - résident (PROPRIETAIRE/LOCATAIRE) : un incident de PARTIE COMMUNE (lotId nul) de sa
 *     résidence, OU un incident portant sur un lot qu'il détient/occupe (rattachement
 *     actif). JAMAIS l'incident d'un autre lot.
 *
 * Aucune donnée de `Person` n'est lue : le mur repose sur `LotAttachment`. Renvoie `null`
 * en cas de refus (pas de fuite d'existence).
 */
import type { SqlExecutor } from '@/server/db/sql';
import type { ActiveContext } from '@/server/auth/context';

export interface IncidentMeta {
  id: string;
  residenceId: string;
  lotId: string | null;
  reportedByPersonId: string | null;
}

function isStaff(role: ActiveContext['role']): boolean {
  return role === 'SYNDIC' || role === 'GESTIONNAIRE';
}

/** La personne a-t-elle un rattachement ACTIF (quel que soit le rôle) sur ce lot ? */
async function hasActiveLotLink(
  exec: SqlExecutor,
  personId: string,
  residenceId: string,
  lotId: string,
): Promise<boolean> {
  const rows = await exec.query<{ ok: number }>(
    `SELECT 1 AS ok FROM "LotAttachment"
      WHERE "personId" = $1 AND "residenceId" = $2 AND "lotId" = $3 AND "endDate" IS NULL
      LIMIT 1`,
    [personId, residenceId, lotId],
  );
  return rows.length > 0;
}

/** Accès à un incident précis ? Renvoie ses métadonnées si oui, `null` sinon. */
export async function canAccessIncident(
  exec: SqlExecutor,
  ctx: ActiveContext,
  incidentId: string,
): Promise<IncidentMeta | null> {
  const rows = await exec.query<IncidentMeta>(
    `SELECT id, "residenceId", "lotId", "reportedByPersonId"
       FROM "Incident" WHERE id = $1 AND "residenceId" = $2 LIMIT 1`,
    [incidentId, ctx.residenceId],
  );
  const inc = rows[0];
  if (!inc) return null;
  if (isStaff(ctx.role)) return inc;
  // Résident : partie commune (lotId nul) OU un de ses lots.
  if (inc.lotId === null) return inc;
  if (await hasActiveLotLink(exec, ctx.personId, ctx.residenceId, inc.lotId)) return inc;
  return null;
}

/** Peut-on servir la photo `fileId` à ce contexte ? Vrai seulement via un incident accessible. */
export async function canServeIncidentPhoto(
  exec: SqlExecutor,
  ctx: ActiveContext,
  fileId: string,
): Promise<boolean> {
  const rows = await exec.query<{ id: string }>(
    `SELECT id FROM "Incident" WHERE "photoId" = $1 AND "residenceId" = $2 LIMIT 1`,
    [fileId, ctx.residenceId],
  );
  const inc = rows[0];
  if (!inc) return false;
  return (await canAccessIncident(exec, ctx, inc.id)) !== null;
}
