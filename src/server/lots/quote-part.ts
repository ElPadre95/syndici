/**
 * Répartition des quotes-parts (millièmes) — PURE et testable.
 *
 * À la génération, on répartit les 1000 millièmes entre les lots créés ; le reste
 * de la division entière va aux premiers lots pour que le total fasse EXACTEMENT
 * la cible (1000 par convention). La répartition reste modifiable ensuite lot par
 * lot ; l'avertissement de déséquilibre n'apparaît donc que si le syndic modifie
 * lui-même les valeurs.
 */
export const QUOTE_PART_TARGET = 1000;

export function distributeQuoteParts(count: number, total: number = QUOTE_PART_TARGET): number[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}
