/**
 * Modèle de fichier d'import (A7) + ordre canonique des colonnes. Le modèle
 * téléchargeable (fr/ar) porte les en-têtes attendus et une ligne d'exemple : un
 * syndic part de ce fichier plutôt que de deviner le format. Les libellés viennent
 * des catalogues (passés en argument) — aucun texte en dur ici.
 */
import ExcelJS from 'exceljs';
import type { Column } from './normalize';

/** Ordre d'affichage des colonnes dans le modèle (référence d'abord). */
export const TEMPLATE_COLUMNS: readonly Column[] = [
  'reference',
  'unitType',
  'floor',
  'surface',
  'quotePart',
  'charge',
  'ownerName',
  'ownerEmail',
  'ownerPhone',
  'ownerCountry',
  'ownerLocale',
  'tenantName',
  'tenantEmail',
  'tenantPhone',
  'tenantCountry',
  'tenantLocale',
  'tenantDelegated',
  'occupancy',
];

/** Construit le classeur .xlsx du modèle : en-têtes + une ligne d'exemple. */
export async function buildTemplateBuffer(
  headers: string[],
  example: string[],
  sheetName: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  ws.addRow(example);
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => {
    c.width = 22;
  });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
