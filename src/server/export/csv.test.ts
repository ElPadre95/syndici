/**
 * Export CSV (I8) — sérialisation PURE. Échappement RFC 4180, BOM UTF-8, séparateur « ; ».
 */
import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

describe('toCsv (pur)', () => {
  it('assemble en-têtes + lignes avec « ; » et un BOM UTF-8', () => {
    const csv = toCsv(['A', 'B'], [['1', '2'], [3, 4]]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.replace('﻿', '').trimEnd().split('\r\n');
    expect(lines).toEqual(['A;B', '1;2', '3;4']);
  });

  it('échappe les champs contenant séparateur, guillemet ou saut de ligne', () => {
    const csv = toCsv(['x'], [['a;b'], ['dit "oui"'], ['ligne1\nligne2']]);
    const lines = csv.replace('﻿', '').trimEnd().split('\r\n');
    expect(lines[1]).toBe('"a;b"');
    expect(lines[2]).toBe('"dit ""oui"""');
    expect(lines[3]).toBe('"ligne1\nligne2"');
  });
});
