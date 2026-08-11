/**
 * Validation du formulaire de création de résidence (A2) — PURE et testable.
 * Renvoie soit des valeurs typées prêtes pour la base (montants en centimes),
 * soit des erreurs par champ sous forme de CODES (le rendu i18n est fait côté UI).
 */
import { toCentimes } from '@/lib/money';

export type ResidenceType = 'IMMEUBLE' | 'VILLA' | 'MIXTE';
const TYPES: readonly ResidenceType[] = ['IMMEUBLE', 'VILLA', 'MIXTE'];

export interface ResidenceFormRaw {
  name: string;
  address: string;
  city: string;
  type: string;
  unitsCount: string;
  chargeAppt: string;
  chargeVilla: string;
  dueDay: string;
}

export interface ResidenceDraft {
  name: string;
  address: string | null;
  city: string;
  type: ResidenceType;
  defaultUnitsCount: number;
  defaultChargeApptMinor: number;
  defaultChargeVillaMinor: number;
  dueDayOfMonth: number;
}

export type ResidenceField =
  'name' | 'city' | 'type' | 'unitsCount' | 'chargeAppt' | 'chargeVilla' | 'dueDay';

export type FieldErrors = Partial<Record<ResidenceField, string>>;

export type ValidationResult =
  { ok: true; value: ResidenceDraft } | { ok: false; errors: FieldErrors };

/** État de l'action de création (partagé entre l'action serveur et le formulaire client). */
export interface CreateResidenceState {
  errors?: FieldErrors;
  formError?: string;
}

/** Un montant en DH : entier ou décimal à 2 décimales, positif. */
function parseAmountDh(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function validateResidenceInput(raw: ResidenceFormRaw): ValidationResult {
  const errors: FieldErrors = {};

  const name = raw.name.trim();
  if (!name) errors.name = 'required';

  const city = raw.city.trim();
  if (!city) errors.city = 'required';

  const type = raw.type as ResidenceType;
  if (!TYPES.includes(type)) errors.type = 'invalidType';

  const units = Number(raw.unitsCount.trim());
  if (!Number.isInteger(units) || units < 1) errors.unitsCount = 'min1';

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
      defaultUnitsCount: units,
      defaultChargeApptMinor: apptMinor,
      defaultChargeVillaMinor: villaMinor,
      dueDayOfMonth: dueDay,
    },
  };
}
