/**
 * MUR DES CHANTIERS (I7) — point de contrôle du service des fichiers (devis PDF, photos).
 * Le scope résidence ne suffit pas : un chantier INTERNE ne doit jamais servir ses fichiers à
 * un propriétaire. Règle : staff → tout chantier de sa résidence ; résident → seulement les
 * chantiers PARTAGE. Aucune donnée de `Person` lue.
 */
import type { SqlExecutor } from '@/server/db/sql';
import type { ActiveContext } from '@/server/auth/context';

/** Peut-on servir ce fichier (devis ou photo) à ce contexte ? */
export async function canServeWorksFile(
  exec: SqlExecutor,
  ctx: ActiveContext,
  fileId: string,
): Promise<boolean> {
  const rows = await exec.query<{ visibility: string }>(
    `SELECT p.visibility FROM "WorksProject" p
       WHERE p."residenceId" = $2
         AND (EXISTS (SELECT 1 FROM "WorksQuote" q WHERE q."fileAssetId" = $1 AND q."projectId" = p.id)
              OR EXISTS (SELECT 1 FROM "WorksPhoto" ph WHERE ph."fileAssetId" = $1 AND ph."projectId" = p.id))
       LIMIT 1`,
    [fileId, ctx.residenceId],
  );
  const row = rows[0];
  if (!row) return false;
  if (ctx.role === 'SYNDIC' || ctx.role === 'GESTIONNAIRE') return true;
  return row.visibility === 'PARTAGE';
}
