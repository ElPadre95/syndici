/**
 * Annuaire (F2) — filtrage PUR. Recherche par nom/pays/lot, filtre rôle et état de compte.
 */
import { describe, it, expect } from 'vitest';
import { matchesResidentFilters, type FilterableResident } from './filter';

const sara: FilterableResident = {
  fullName: 'Sara Tahiri',
  country: 'France',
  lots: [{ reference: 'A1' }, { reference: 'A7' }],
  roles: ['OWNER'],
  accountStatus: 'ACTIVE',
};
const omar: FilterableResident = {
  fullName: 'Omar Locataire',
  country: 'Maroc',
  lots: [{ reference: 'B4' }],
  roles: ['TENANT'],
  accountStatus: 'NEVER',
};

const ALL = { query: '', role: 'ALL', status: 'ALL' } as const;

describe('matchesResidentFilters', () => {
  it('sans filtre : tout passe', () => {
    expect(matchesResidentFilters(sara, ALL)).toBe(true);
    expect(matchesResidentFilters(omar, ALL)).toBe(true);
  });
  it('recherche par nom, pays et référence de lot', () => {
    expect(matchesResidentFilters(sara, { ...ALL, query: 'tahiri' })).toBe(true);
    expect(matchesResidentFilters(sara, { ...ALL, query: 'france' })).toBe(true);
    expect(matchesResidentFilters(sara, { ...ALL, query: 'a7' })).toBe(true);
    expect(matchesResidentFilters(sara, { ...ALL, query: 'zzz' })).toBe(false);
  });
  it('filtre par rôle', () => {
    expect(matchesResidentFilters(sara, { ...ALL, role: 'OWNER' })).toBe(true);
    expect(matchesResidentFilters(sara, { ...ALL, role: 'TENANT' })).toBe(false);
    expect(matchesResidentFilters(omar, { ...ALL, role: 'TENANT' })).toBe(true);
  });
  it('filtre par état de compte', () => {
    expect(matchesResidentFilters(sara, { ...ALL, status: 'ACTIVE' })).toBe(true);
    expect(matchesResidentFilters(sara, { ...ALL, status: 'NEVER' })).toBe(false);
    expect(matchesResidentFilters(omar, { ...ALL, status: 'NEVER' })).toBe(true);
  });
  it('combine recherche et filtres (ET logique)', () => {
    expect(matchesResidentFilters(sara, { query: 'sara', role: 'OWNER', status: 'ACTIVE' })).toBe(
      true,
    );
    expect(matchesResidentFilters(sara, { query: 'sara', role: 'TENANT', status: 'ALL' })).toBe(
      false,
    );
  });
});
