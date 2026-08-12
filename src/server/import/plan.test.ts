import { describe, it, expect } from 'vitest';
import { planImport, type RejectReason } from './plan';
import type { ParsedSheet, RawRow } from './parse';
import type { Column } from './normalize';

function sheet(rows: Array<Partial<Record<Column, string>>>, columns: Column[]): ParsedSheet {
  const raw: RawRow[] = rows.map((values, i) => ({ rowNumber: i + 2, values }));
  return { rows: raw, recognizedColumns: columns };
}

const reasonAt = (plan: ReturnType<typeof planImport>, i: number): RejectReason | undefined =>
  plan.rows[i]?.reason;

describe('planImport — aperçu avant écriture', () => {
  it('un fichier où seules les références sont renseignées s’importe', () => {
    const plan = planImport(
      sheet([{ reference: 'A1' }, { reference: 'A2' }], ['reference']),
      new Set(),
    );
    expect(plan.counts).toMatchObject({ total: 2, create: 2, reject: 0, exists: 0 });
    expect(plan.rows[0]!.lot).toMatchObject({
      reference: 'A1',
      type: 'APPARTEMENT', // défaut
      occupancy: 'VACANT', // pas de locataire
      quotePart: null, // colonne absente → réparti à l'écriture
    });
    expect(plan.rows[0]!.owner).toBeNull();
  });

  it('classe une référence déjà présente en « exists » (idempotence, jamais réécrite)', () => {
    const plan = planImport(sheet([{ reference: 'A1' }], ['reference']), new Set(['A1']));
    expect(plan.rows[0]!.status).toBe('exists');
    expect(plan.counts.create).toBe(0);
  });

  it('rejette un doublon de référence DANS le fichier', () => {
    const plan = planImport(
      sheet([{ reference: 'A1' }, { reference: 'A1' }], ['reference']),
      new Set(),
    );
    expect(plan.rows[0]!.status).toBe('create');
    expect(plan.rows[1]!.status).toBe('reject');
    expect(reasonAt(plan, 1)).toBe('duplicate_in_file');
  });

  it('rejette chaque cas défectueux avec le bon motif', () => {
    const plan = planImport(
      sheet(
        [
          { ownerName: 'Sans réf' }, // pas de référence
          { reference: 'B1', tenantName: 'Locataire seul' }, // locataire sans propriétaire
          { reference: 'B2', charge: 'illisible' }, // montant illisible
          { reference: 'B3', quotePart: '0' }, // quote-part invalide
          { reference: 'B4', ownerName: 'A B', ownerEmail: 'pas-un-email' }, // e-mail
          { reference: 'B5', unitType: 'garage' }, // type inconnu
        ],
        ['reference', 'ownerName', 'tenantName', 'charge', 'quotePart', 'ownerEmail', 'unitType'],
      ),
      new Set(),
    );
    expect(plan.rows.map((r) => r.reason)).toEqual([
      'missing_reference',
      'tenant_without_owner',
      'unreadable_amount',
      'invalid_quote_part',
      'malformed_email',
      'unknown_unit_type',
    ]);
    expect(plan.counts.reject).toBe(6);
  });

  it('construit propriétaire + locataire délégué (lot loué)', () => {
    const plan = planImport(
      sheet(
        [
          {
            reference: 'C1',
            unitType: 'Villa',
            ownerName: 'Youssef Chraibi',
            ownerEmail: 'y@example.ma',
            ownerCountry: 'Pays-Bas',
            ownerLocale: 'ar',
            tenantName: 'Hind Alaoui',
            tenantDelegated: 'oui',
            charge: '1 200,00',
          },
        ],
        [
          'reference',
          'unitType',
          'ownerName',
          'ownerEmail',
          'ownerCountry',
          'ownerLocale',
          'tenantName',
          'tenantDelegated',
          'charge',
        ],
      ),
      new Set(),
    );
    const row = plan.rows[0]!;
    expect(row.status).toBe('create');
    expect(row.lot).toMatchObject({
      type: 'VILLA',
      occupancy: 'RENTED',
      monthlyChargeMinor: 120000,
    });
    expect(row.owner).toMatchObject({ firstName: 'Youssef', lastName: 'Chraibi', locale: 'ar' });
    expect(row.tenant).toMatchObject({ firstName: 'Hind', lastName: 'Alaoui' });
    expect(row.delegated).toBe(true);
  });

  it('hasQuotePartColumn reflète la présence de la colonne', () => {
    expect(
      planImport(sheet([{ reference: 'A' }], ['reference']), new Set()).hasQuotePartColumn,
    ).toBe(false);
    expect(
      planImport(
        sheet([{ reference: 'A', quotePart: '10' }], ['reference', 'quotePart']),
        new Set(),
      ).hasQuotePartColumn,
    ).toBe(true);
  });
});
