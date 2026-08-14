/**
 * Réglages (F1) — validation PURE. Résidence (montants en centimes, échéance bornée),
 * règle de relance (seuils, statuts), libellé de catégorie.
 */
import { describe, it, expect } from 'vitest';
import { validateResidenceEdit, validateReminderRule, validateCategoryLabel } from './validation';

describe('validateResidenceEdit', () => {
  const ok = {
    name: 'Al Firdaous',
    address: 'Bd Zerktouni',
    city: 'Casablanca',
    type: 'MIXTE',
    chargeAppt: '650,00',
    chargeVilla: '1 200,00',
    dueDay: '5',
  };
  it('accepte une saisie valide et convertit en centimes', () => {
    const res = validateResidenceEdit(ok);
    expect(res.ok && res.value).toMatchObject({
      name: 'Al Firdaous',
      city: 'Casablanca',
      type: 'MIXTE',
      defaultChargeApptMinor: 65000,
      defaultChargeVillaMinor: 120000,
      dueDayOfMonth: 5,
    });
  });
  it('exige le nom et la ville, et borne le jour d’échéance', () => {
    const r = validateResidenceEdit({ ...ok, name: '  ', city: '', dueDay: '31' });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toEqual({ name: 'required', city: 'required', dueDay: 'dueDayRange' });
  });
  it('n’exige pas la charge appartement pour une VILLA', () => {
    const r = validateResidenceEdit({ ...ok, type: 'VILLA', chargeAppt: '' });
    expect(r.ok).toBe(true);
  });
});

describe('validateReminderRule', () => {
  it('accepte des seuils valides et ne garde que les statuts concernables', () => {
    const r = validateReminderRule({
      overdueThresholdDays: '5',
      minDaysBetweenReminders: '7',
      concernedSettlementStates: ['PARTIAL', 'SETTLED', 'UNSETTLED'],
    });
    expect(r.ok && r.value).toEqual({
      overdueThresholdDays: 5,
      minDaysBetweenReminders: 7,
      concernedSettlementStates: ['PARTIAL', 'UNSETTLED'], // SETTLED écarté
    });
  });
  it('refuse un délai < 1 et une liste de statuts vide', () => {
    const r = validateReminderRule({
      overdueThresholdDays: '3',
      minDaysBetweenReminders: '0',
      concernedSettlementStates: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toEqual({
        minDaysBetweenReminders: 'min1',
        concernedSettlementStates: 'atLeastOne',
      });
  });
});

describe('validateCategoryLabel', () => {
  it('trim et refuse le vide', () => {
    expect(validateCategoryLabel('  Ascenseur ')).toEqual({ ok: true, label: 'Ascenseur' });
    expect(validateCategoryLabel('   ')).toEqual({ ok: false });
  });
});
