import { describe, it, expect } from 'vitest';
import {
  resolveHeader,
  parseMoneyToCentimes,
  parseIntLoose,
  normalizeEmail,
  mapUnitType,
  mapLocale,
  mapOccupancy,
  parseBool,
  splitName,
} from './normalize';

describe('parseMoneyToCentimes — tolérant aux formats réels', () => {
  it('lit les formats attendus d’un syndic marocain', () => {
    expect(parseMoneyToCentimes('650')).toBe(65000);
    expect(parseMoneyToCentimes('650,00')).toBe(65000);
    expect(parseMoneyToCentimes('1 200,00')).toBe(120000); // espace = milliers, virgule = décimale
    expect(parseMoneyToCentimes('1 200,50')).toBe(120050); // espace insécable
    expect(parseMoneyToCentimes('1 200')).toBe(120000);
    expect(parseMoneyToCentimes('1,200.00')).toBe(120000); // format anglo
    expect(parseMoneyToCentimes('1.200,00')).toBe(120000); // format continental
    expect(parseMoneyToCentimes('650 MAD')).toBe(65000);
    expect(parseMoneyToCentimes("1'200")).toBe(120000); // apostrophe = milliers
  });

  it('renvoie null sur illisible ou négatif (→ rejet « montant illisible »)', () => {
    expect(parseMoneyToCentimes('')).toBeNull();
    expect(parseMoneyToCentimes('abc')).toBeNull();
    expect(parseMoneyToCentimes('-5')).toBeNull();
  });

  it('gère 0 et une seule décimale', () => {
    expect(parseMoneyToCentimes('0')).toBe(0);
    expect(parseMoneyToCentimes('650,5')).toBe(65050);
  });
});

describe('resolveHeader — ordre libre, casse/accents/langue tolérés', () => {
  it('associe les en-têtes français, même approximatifs', () => {
    expect(resolveHeader('Référence')).toBe('reference');
    expect(resolveHeader('REF. lot')).toBe('reference');
    expect(resolveHeader("Type d'unité")).toBe('unitType');
    expect(resolveHeader('Étage')).toBe('floor');
    expect(resolveHeader('Surface (m²)')).toBe('surface');
    expect(resolveHeader('Quote-part')).toBe('quotePart');
    expect(resolveHeader('Charges mensuelles')).toBe('charge');
    expect(resolveHeader('Nom du propriétaire')).toBe('ownerName');
    expect(resolveHeader('Email propriétaire')).toBe('ownerEmail');
    expect(resolveHeader('Téléphone du locataire')).toBe('tenantPhone');
    expect(resolveHeader('Locataire')).toBe('tenantName');
    expect(resolveHeader('Charges déléguées')).toBe('tenantDelegated');
    expect(resolveHeader("Mode d'occupation")).toBe('occupancy');
  });

  it('associe des en-têtes arabes', () => {
    expect(resolveHeader('مرجع العقار')).toBe('reference');
    expect(resolveHeader('اسم المالك')).toBe('ownerName');
  });

  it('renvoie null pour une colonne non reconnue (ignorée)', () => {
    expect(resolveHeader('Colonne inconnue')).toBeNull();
    expect(resolveHeader('')).toBeNull();
  });
});

describe('mappers d’énumérations', () => {
  it('mapUnitType', () => {
    expect(mapUnitType('Appartement')).toBe('APPARTEMENT');
    expect(mapUnitType('appt')).toBe('APPARTEMENT');
    expect(mapUnitType('شقة')).toBe('APPARTEMENT');
    expect(mapUnitType('Villa')).toBe('VILLA');
    expect(mapUnitType('')).toBe('APPARTEMENT'); // défaut
    expect(mapUnitType('garage')).toBeNull(); // inconnu → rejet
  });

  it('mapOccupancy', () => {
    expect(mapOccupancy('Vacant')).toBe('VACANT');
    expect(mapOccupancy('Loué')).toBe('RENTED');
    expect(mapOccupancy('Occupé par le propriétaire')).toBe('OWNER_OCCUPIED');
    expect(mapOccupancy('')).toBeNull(); // absent → déduction en aval
    expect(mapOccupancy('n/a')).toBeNull();
  });

  it('mapLocale et parseBool', () => {
    expect(mapLocale('Arabe')).toBe('ar');
    expect(mapLocale('Français')).toBe('fr');
    expect(mapLocale('')).toBe('fr');
    expect(parseBool('Oui')).toBe(true);
    expect(parseBool('non')).toBe(false);
    expect(parseBool('')).toBe(false);
    expect(parseBool('نعم')).toBe(true);
  });
});

describe('email, entier, nom', () => {
  it('normalizeEmail distingue absent, valide, mal formé', () => {
    expect(normalizeEmail('')).toEqual({ ok: true, value: null });
    expect(normalizeEmail('a.b@example.ma')).toEqual({ ok: true, value: 'a.b@example.ma' });
    expect(normalizeEmail('pas-un-email')).toEqual({ ok: false });
  });

  it('parseIntLoose', () => {
    expect(parseIntLoose('5')).toBe(5);
    expect(parseIntLoose('')).toBeNull();
    expect(parseIntLoose('3,0')).toBe(3);
    expect(parseIntLoose('-2')).toBeNull();
  });

  it('splitName gère un ou plusieurs mots', () => {
    expect(splitName('Youssef Chraibi')).toEqual({ firstName: 'Youssef', lastName: 'Chraibi' });
    expect(splitName('Chraibi')).toEqual({ firstName: '', lastName: 'Chraibi' });
    expect(splitName('Ali Ben Salah')).toEqual({ firstName: 'Ali', lastName: 'Ben Salah' });
  });
});
