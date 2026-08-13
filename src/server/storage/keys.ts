/**
 * Construction de la clé de stockage (C0). La clé porte TOUJOURS la résidence :
 * `residences/<residenceId>/<bucket>/<fileId>.<ext>`. Tous les segments sont
 * assainis (alphanumérique + `-`/`_`) → aucune traversée de chemin possible.
 */
function safe(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function storageKeyFor(
  residenceId: string,
  bucket: string,
  fileId: string,
  ext: string,
): string {
  return `residences/${safe(residenceId)}/${safe(bucket)}/${safe(fileId)}.${safe(ext)}`;
}
