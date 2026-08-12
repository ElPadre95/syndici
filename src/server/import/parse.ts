/**
 * Lecture d'un fichier d'import (A7) — .xlsx (ExcelJS) ou .csv (parseur tolérant).
 * Sépare la LECTURE (ici) de la normalisation des valeurs (normalize.ts) et de la
 * validation métier (plan.ts). Robuste à un fichier hostile : formules, cellules
 * vides, ligne vide au milieu, très longues chaînes, ordre de colonnes libre.
 */
import ExcelJS from 'exceljs';
import { resolveHeader, cell, foldText, type Column } from './normalize';

/** Bornes. Une transaction unique sur ~60 lignes est triviale ; on plafonne bas et
 * on documente : au-delà, découper le fichier (l'optimisation du verrouillage de
 * masse est repoussée). Voir PROGRESS.md / CONVENTIONS. */
export const MAX_ROWS = 500;
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 Mo
const MAX_CELL_CHARS = 500; // tronque une très longue chaîne (pas d'explosion mémoire/UI)

export type ImportFileErrorCode = 'too_large' | 'too_many_rows' | 'unreadable' | 'no_columns';

export class ImportFileError extends Error {
  constructor(public code: ImportFileErrorCode) {
    super(code);
    this.name = 'ImportFileError';
  }
}

export interface RawRow {
  /** Numéro de ligne DANS LE FICHIER (1-based, en-tête comprise) — pour le rapport. */
  rowNumber: number;
  values: Partial<Record<Column, string>>;
}

export interface ParsedSheet {
  rows: RawRow[];
  recognizedColumns: Column[];
}

/** Texte d'une cellule ExcelJS, quel que soit son type (formule, date, lien, riche). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue); // formule → résultat calculé
    if ('text' in v) return String(v.text); // lien hypertexte
    if ('richText' in v && Array.isArray(v.richText))
      return v.richText.map((r) => (r as { text?: string }).text ?? '').join('');
    return '';
  }
  return String(value);
}

function clip(s: string): string {
  return s.length > MAX_CELL_CHARS ? s.slice(0, MAX_CELL_CHARS) : s;
}

/** Parseur CSV minimal mais correct : guillemets, délimiteur détecté (`,` `;` tab). */
function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  const counts = { ';': 0, ',': 0, '\t': 0 } as Record<string, number>;
  for (const ch of firstLine) if (ch in counts) counts[ch]!++;
  const delimiter = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ',') as string;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Lit .xlsx en matrice de chaînes (première feuille), en-tête comprise. */
async function parseXlsxMatrix(buffer: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const vals: string[] = [];
    row.eachCell({ includeEmpty: true }, (c, colNumber) => {
      vals[colNumber - 1] = cellText(c.value);
    });
    matrix.push(vals);
  });
  return matrix;
}

function isBlank(cells: string[]): boolean {
  return cells.every((c) => cell(c) === '');
}

/**
 * Lit un fichier d'import et renvoie des lignes brutes indexées par colonne canonique.
 * Ne valide RIEN (voir plan.ts). Ignore les lignes entièrement vides (y compris au
 * milieu). Lève ImportFileError sur fichier trop lourd / trop de lignes / illisible.
 */
export async function parseImport(buffer: ArrayBuffer, filename: string): Promise<ParsedSheet> {
  if (buffer.byteLength > MAX_FILE_BYTES) throw new ImportFileError('too_large');

  let matrix: string[][];
  try {
    if (/\.csv$/i.test(filename)) {
      matrix = parseCsv(new TextDecoder('utf-8').decode(buffer));
    } else {
      matrix = await parseXlsxMatrix(buffer);
    }
  } catch {
    throw new ImportFileError('unreadable');
  }

  // Première ligne non vide = en-têtes.
  const headerIdx = matrix.findIndex((r) => !isBlank(r));
  if (headerIdx === -1) throw new ImportFileError('no_columns');
  const headers = matrix[headerIdx]!;

  const colOf = new Map<number, Column>();
  const recognized = new Set<Column>();
  headers.forEach((h, i) => {
    const col = resolveHeader(h);
    // Première colonne gagnante en cas de doublon d'en-tête (on n'écrase pas).
    if (col && !recognized.has(col)) {
      colOf.set(i, col);
      recognized.add(col);
    }
  });
  if (colOf.size === 0) throw new ImportFileError('no_columns');

  const rows: RawRow[] = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r]!;
    if (isBlank(cells)) continue; // ligne vide (même au milieu) : ignorée
    const values: Partial<Record<Column, string>> = {};
    for (const [i, col] of colOf) {
      const v = clip(cell(cells[i] ?? ''));
      if (v !== '') values[col] = v;
    }
    rows.push({ rowNumber: r + 1, values });
    if (rows.length > MAX_ROWS) throw new ImportFileError('too_many_rows');
  }

  return { rows, recognizedColumns: [...recognized] };
}

/** Exposé pour les tests d'en-têtes hostiles. */
export { foldText };
