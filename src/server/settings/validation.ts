/**
 * Validation des réglages (F1) — PURE et testable. Renvoie des valeurs typées prêtes
 * pour la base (montants en centimes) ou des erreurs par champ (codes ; i18n côté UI).
 */
import { toCentimes } from '@/lib/money';

export type ResidenceType = 'IMMEUBLE' | 'VILLA' | 'MIXTE';
const TYPES: readonly ResidenceType[] = ['IMMEUBLE', 'VILLA', 'MIXTE'];

export type SettlementState = 'SETTLED' | 'PARTIAL' | 'UNSETTLED';
/** États relançables proposés au réglage (SETTLED n'a aucun sens à relancer). */
export const CONCERNABLE_STATES: readonly SettlementState[] = ['PARTIAL', 'UNSETTLED'];

function parseAmountDh(raw: string): number | null {
  // Retire les espaces (séparateurs de milliers, ex. « 1 200,00 ») et la virgule décimale.
  const t = raw.replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ── Résidence ────────────────────────────────────────────────────────────────

export interface ResidenceEditRaw {
  name: string;
  address: string;
  city: string;
  type: string;
  chargeAppt: string;
  chargeVilla: string;
  dueDay: string;
}
export interface ResidenceEditValue {
  name: string;
  address: string | null;
  city: string;
  type: ResidenceType;
  defaultChargeApptMinor: number;
  defaultChargeVillaMinor: number;
  dueDayOfMonth: number;
}
export type ResidenceEditField = 'name' | 'city' | 'type' | 'chargeAppt' | 'chargeVilla' | 'dueDay';
export type ResidenceEditResult =
  | { ok: true; value: ResidenceEditValue }
  | { ok: false; errors: Partial<Record<ResidenceEditField, string>> };

export function validateResidenceEdit(raw: ResidenceEditRaw): ResidenceEditResult {
  const errors: Partial<Record<ResidenceEditField, string>> = {};
  const name = raw.name.trim();
  if (!name) errors.name = 'required';
  const city = raw.city.trim();
  if (!city) errors.city = 'required';
  const type = raw.type as ResidenceType;
  if (!TYPES.includes(type)) errors.type = 'invalidType';

  const needsAppt = type === 'IMMEUBLE' || type === 'MIXTE';
  const needsVilla = type === 'VILLA' || type === 'MIXTE';
  let apptMinor = 0;
  if (needsAppt) {
    const dh = parseAmountDh(raw.chargeAppt);
    if (dh === null) errors.chargeAppt = 'amountInvalid';
    else apptMinor = toCentimes(dh);
  }
  let villaMinor = 0;
  if (needsVilla) {
    const dh = parseAmountDh(raw.chargeVilla);
    if (dh === null) errors.chargeVilla = 'amountInvalid';
    else villaMinor = toCentimes(dh);
  }
  const dueDay = Number(raw.dueDay.trim());
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) errors.dueDay = 'dueDayRange';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      address: raw.address.trim() || null,
      city,
      type,
      defaultChargeApptMinor: apptMinor,
      defaultChargeVillaMinor: villaMinor,
      dueDayOfMonth: dueDay,
    },
  };
}

// ── Règle de relance ─────────────────────────────────────────────────────────

export interface ReminderRuleRaw {
  overdueThresholdDays: string;
  minDaysBetweenReminders: string;
  concernedSettlementStates: string[];
}
export interface ReminderRuleValue {
  overdueThresholdDays: number;
  minDaysBetweenReminders: number;
  concernedSettlementStates: SettlementState[];
}
export type ReminderRuleField =
  'overdueThresholdDays' | 'minDaysBetweenReminders' | 'concernedSettlementStates';
export type ReminderRuleResult =
  | { ok: true; value: ReminderRuleValue }
  | { ok: false; errors: Partial<Record<ReminderRuleField, string>> };

export function validateReminderRule(raw: ReminderRuleRaw): ReminderRuleResult {
  const errors: Partial<Record<ReminderRuleField, string>> = {};
  const overdue = Number(String(raw.overdueThresholdDays).trim());
  if (!Number.isInteger(overdue) || overdue < 0) errors.overdueThresholdDays = 'min0';
  const cooldown = Number(String(raw.minDaysBetweenReminders).trim());
  if (!Number.isInteger(cooldown) || cooldown < 1) errors.minDaysBetweenReminders = 'min1';
  const states = raw.concernedSettlementStates.filter((s): s is SettlementState =>
    CONCERNABLE_STATES.includes(s as SettlementState),
  );
  if (states.length === 0) errors.concernedSettlementStates = 'atLeastOne';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      overdueThresholdDays: overdue,
      minDaysBetweenReminders: cooldown,
      concernedSettlementStates: states,
    },
  };
}

/** Libellé de catégorie : non vide après trim. */
export function validateCategoryLabel(raw: string): { ok: true; label: string } | { ok: false } {
  const label = raw.trim();
  return label ? { ok: true, label } : { ok: false };
}
