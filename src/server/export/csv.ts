/**
 * Export CSV (I8) — sérialisation PURE et sûre. Chaque champ est échappé selon RFC 4180
 * (guillemets doublés, entourage si séparateur/guillemet/saut de ligne), et un BOM UTF-8 est
 * ajouté pour qu'Excel ouvre correctement les accents et l'arabe. Séparateur « ; » (tableurs FR).
 */

const SEP = ';';
const BOM = '﻿';

function escapeField(value: string): string {
  const needsQuoting = value.includes(SEP) || value.includes('"') || /[\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

/** Construit un CSV (BOM + en-têtes + lignes). Toute valeur est convertie en chaîne. */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeField(String(cell))).join(SEP),
  );
  return BOM + lines.join('\r\n') + '\r\n';
}
