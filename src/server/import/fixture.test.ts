/**
 * Lit le VRAI fichier de test (fixtures/import-lots-test.xlsx) — messy, réaliste —
 * via le lecteur réel puis le plan. Prouve qu'un fichier hostile (accents, arabe,
 * téléphones hétérogènes, montants variés, colonnes en désordre, cellules vides,
 * ligne vide au milieu, en-têtes approximatifs) ne provoque NI erreur ni mauvaise
 * classification. C'est ce fichier qui dit si l'import tient.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseImport } from './parse';
import { planImport, type RejectReason } from './plan';

function fixtureBuffer(): ArrayBuffer {
  const b = readFileSync(join(process.cwd(), 'fixtures', 'import-lots-test.xlsx'));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

describe('fichier de test réaliste', () => {
  it('se lit sans erreur et classe correctement lignes valides et rejets', async () => {
    const sheet = await parseImport(fixtureBuffer(), 'import-lots-test.xlsx');
    const plan = planImport(sheet, new Set()); // résidence vide

    // En-têtes approximatifs/désordonnés bien reconnus.
    expect(sheet.recognizedColumns).toEqual(
      expect.arrayContaining(['reference', 'ownerName', 'ownerEmail', 'charge', 'occupancy']),
    );

    // 52 à créer (50 grille + 2 MRE), 7 rejets, ligne vide ignorée.
    expect(plan.counts.create).toBe(52);
    expect(plan.counts.reject).toBe(7);

    const reasons = new Set(plan.rows.filter((r) => r.reason).map((r) => r.reason as RejectReason));
    expect(reasons).toEqual(
      new Set<RejectReason>([
        'duplicate_in_file',
        'tenant_without_owner',
        'unreadable_amount',
        'invalid_quote_part',
        'malformed_email',
        'unknown_unit_type',
        'missing_reference',
      ]),
    );
  });

  it('lit un montant « 1 200,00 » et un nom arabe sans les corrompre', async () => {
    const sheet = await parseImport(fixtureBuffer(), 'import-lots-test.xlsx');
    const plan = planImport(sheet, new Set());
    // Au moins une charge de 120000 centimes issue d'un « 1 200,00 ».
    expect(plan.rows.some((r) => r.lot?.monthlyChargeMinor === 120000)).toBe(true);
    // Au moins un propriétaire au nom arabe conservé.
    expect(plan.rows.some((r) => /[؀-ۿ]/.test(r.ownerName ?? ''))).toBe(true);
  });
});
