/**
 * Résolution PURE de la résidence active à partir d'un cookie NON FIABLE.
 * Isolée ici (aucune dépendance à Auth.js / Next) pour être testable directement
 * et réutilisée par `src/server/session.ts`.
 *
 * N'honore que les identifiants réellement accessibles ; sinon retombe sur la
 * première résidence accessible, ou `null`. Ne lève jamais (valeur absente,
 * malformée ou inexistante → repli).
 */
export function resolveActiveResidenceId(
  accessibleIds: readonly string[],
  cookieValue: string | null | undefined,
): string | null {
  if (typeof cookieValue === 'string' && accessibleIds.includes(cookieValue)) return cookieValue;
  return accessibleIds[0] ?? null;
}
