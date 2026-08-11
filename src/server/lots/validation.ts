/**
 * Validation des lots (A3) — PURE et testable. Création unitaire + spécification
 * de génération. Renvoie des valeurs typées (montants en centimes) ou des erreurs
 * par champ sous forme de codes (rendu i18n côté UI).
 */
import { toCentimes } from '@/lib/money';
import type { GroupSpec, LotType, RefScheme } from './generation';

const TYPES: readonly LotType[] = ['APPARTEMENT', 'VILLA'];
const SCHEMES: readonly RefScheme[] = ['continuous', 'floor'];

// ── Création unitaire ───────────────────────────────────────────────────────

export interface LotFormRaw {
  reference: string;
  type: string;
  floor: string;
  surfaceM2: string;
  quotePart: string;
  charge: string; // DH ; vide = charge par défaut de la résidence
}

export interface LotDraft {
  reference: string;
  type: LotType;
  floor: string | null;
  surfaceM2: number | null;
  quotePart: number;
  /** null = hériter du défaut de la résidence pour ce type. */
  monthlyChargeMinor: number | null;
}

export type LotField = 'reference' | 'type' | 'surfaceM2' | 'quotePart' | 'charge';
export type LotFieldErrors = Partial<Record<LotField, string>>;
export type LotValidation = { ok: true; value: LotDraft } | { ok: false; errors: LotFieldErrors };

export interface LotFormState {
  errors?: LotFieldErrors;
  formError?: string;
}

function parseOptionalAmount(raw: string): number | null | 'invalid' {
  const t = raw.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return 'invalid';
  return toCentimes(n);
}

export function validateLotInput(raw: LotFormRaw): LotValidation {
  const errors: LotFieldErrors = {};

  const reference = raw.reference.trim();
  if (!reference) errors.reference = 'required';

  const type = raw.type as LotType;
  if (!TYPES.includes(type)) errors.type = 'invalidType';

  let surfaceM2: number | null = null;
  const s = raw.surfaceM2.trim();
  if (s !== '') {
    const n = Number(s);
    if (!Number.isInteger(n) || n < 0) errors.surfaceM2 = 'invalidSurface';
    else surfaceM2 = n;
  }

  const q = raw.quotePart.trim();
  const quotePart = q === '' ? 0 : Number(q);
  if (!Number.isInteger(quotePart) || quotePart < 0) errors.quotePart = 'invalidQuote';

  let monthlyChargeMinor: number | null = null;
  const amount = parseOptionalAmount(raw.charge);
  if (amount === 'invalid') errors.charge = 'amountInvalid';
  else monthlyChargeMinor = amount;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      reference,
      type,
      floor: raw.floor.trim() || null,
      surfaceM2,
      quotePart,
      monthlyChargeMinor,
    },
  };
}

// ── Spécification de génération ─────────────────────────────────────────────

export interface GroupRaw {
  type: string;
  count: string;
  scheme: string;
  prefix: string;
  floors: string;
}

export type GenerationError =
  'noGroups' | 'invalidCount' | 'invalidFloors' | 'invalidType' | 'invalidScheme';

export type GenerationValidation =
  { ok: true; groups: GroupSpec[] } | { ok: false; error: GenerationError };

/** Valide et normalise les groupes de génération. Ignore les groupes à count 0. */
export function validateGenerationInput(rawGroups: readonly GroupRaw[]): GenerationValidation {
  const groups: GroupSpec[] = [];
  for (const g of rawGroups) {
    const count = Number(g.count.trim());
    if (!Number.isInteger(count) || count < 0) return { ok: false, error: 'invalidCount' };
    if (count === 0) continue; // groupe vide : ignoré
    const type = g.type as LotType;
    if (!TYPES.includes(type)) return { ok: false, error: 'invalidType' };
    const scheme = g.scheme as RefScheme;
    if (!SCHEMES.includes(scheme)) return { ok: false, error: 'invalidScheme' };
    let floors: number | undefined;
    if (scheme === 'floor') {
      floors = Number(g.floors.trim());
      if (!Number.isInteger(floors) || floors < 1) return { ok: false, error: 'invalidFloors' };
    }
    groups.push({ type, count, scheme, prefix: g.prefix.trim(), floors });
  }
  if (groups.length === 0) return { ok: false, error: 'noGroups' };
  return { ok: true, groups };
}

/** Seuil d'avertissement quote-part (convention copropriété : total = 1000). */
export const QUOTE_PART_TARGET = 1000;
