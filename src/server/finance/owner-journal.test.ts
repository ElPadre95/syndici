/**
 * Journal du propriétaire (I8) — cœur PUR de la fusion multi-lots. Prouve : tri chronologique
 * décroissant, débit avant crédit à date égale, et étiquetage du lot sur chaque écriture.
 */
import { describe, it, expect } from 'vitest';
import { mergeJournalEntries, journalLabel } from './owner-journal';
import type { LedgerEntry } from './account';

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  date: '2026-06-01T00:00:00.000Z',
  kind: 'charge',
  periodYear: 2026,
  periodMonth: 6,
  method: null,
  receiptId: null,
  receiptNumber: null,
  receiptVoided: false,
  debitMinor: 65000,
  creditMinor: 0,
  balanceMinor: 65000,
  ...over,
});

describe('mergeJournalEntries (pur)', () => {
  it('fusionne plusieurs lots, plus récent d’abord, en étiquetant le lot', () => {
    const merged = mergeJournalEntries([
      { lotReference: 'A1', entries: [entry({ date: '2026-06-01T00:00:00.000Z' })] },
      {
        lotReference: 'A7',
        entries: [
          entry({ date: '2026-08-01T00:00:00.000Z' }),
          entry({ date: '2026-05-01T00:00:00.000Z' }),
        ],
      },
    ]);
    expect(merged.map((e) => [e.date.slice(0, 10), e.lotReference])).toEqual([
      ['2026-08-01', 'A7'],
      ['2026-06-01', 'A1'],
      ['2026-05-01', 'A7'],
    ]);
  });

  it('à date égale, le débit (appel/frais/régul.) précède le crédit (règlement)', () => {
    const merged = mergeJournalEntries([
      {
        lotReference: 'A1',
        entries: [
          entry({ kind: 'payment', debitMinor: 0, creditMinor: 65000, method: 'ESPECES' }),
          entry({ kind: 'charge' }),
        ],
      },
    ]);
    expect(merged.map((e) => e.kind)).toEqual(['charge', 'payment']);
  });
});

describe('journalLabel (pur)', () => {
  const t = (k: string, v?: Record<string, string | number>) =>
    v ? `${k}(${Object.values(v).join(',')})` : k;
  it('mappe chaque type sur sa clé de libellé', () => {
    const base = { lotReference: 'A1' };
    expect(journalLabel(t, { ...entry({ kind: 'latefee' }), ...base }, 'fr')).toBe('label.latefee');
    expect(journalLabel(t, { ...entry({ kind: 'regularisation', periodYear: 2026 }), ...base }, 'fr')).toBe(
      'label.regularisation(2026)',
    );
    expect(
      journalLabel(t, { ...entry({ kind: 'payment', method: 'VIREMENT' }), ...base }, 'fr'),
    ).toBe('label.payment(method.VIREMENT)');
  });
});
