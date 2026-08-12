/**
 * Normalisation TOLÉRANTE des cellules d'un import (A7) — PURE et testable.
 *
 * Un syndic marocain n'enverra pas un fichier propre : accents et caractères arabes,
 * téléphones hétérogènes (+33, 0033, 06 espacé), montants « 650 » / « 650,00 » /
 * « 1 200,00 », en-têtes approximatifs et dans le désordre, cellules et lignes vides.
 * Tout le nettoyage vit ici, séparé de la lecture du fichier et des écritures DB.
 */

/** Colonnes canoniques reconnues. Seule `reference` est obligatoire. */
export type Column =
  | 'reference'
  | 'unitType'
  | 'floor'
  | 'surface'
  | 'quotePart'
  | 'charge'
  | 'ownerName'
  | 'ownerEmail'
  | 'ownerPhone'
  | 'ownerCountry'
  | 'ownerLocale'
  | 'tenantName'
  | 'tenantEmail'
  | 'tenantPhone'
  | 'tenantCountry'
  | 'tenantLocale'
  | 'tenantDelegated'
  | 'occupancy';

/** Minuscule, sans accents/diacritiques, espaces réduits — pour comparer en-têtes et valeurs. */
export function foldText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritiques latins
    .replace(/[\u064b-\u0652]/g, '') // diacritiques arabes (harakat)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Un en-tête contient-il l'un de ces mots-clés ? */
function has(header: string, ...keys: string[]): boolean {
  return keys.some((k) => header.includes(k));
}

/**
 * Associe un en-tête (quelconque, fr/ar/en, approximatif) à une colonne canonique.
 * Tolérant à l'ordre et à la casse ; renvoie null si non reconnu (colonne ignorée).
 */
export function resolveHeader(rawHeader: string): Column | null {
  const h = foldText(rawHeader);
  if (h === '') return null;

  const owner = has(h, 'propriet', 'owner', 'proprio', 'مالك', 'المالك');
  const tenant = has(h, 'locataire', 'tenant', 'مستاجر', 'المستاجر');
  const isEmail = has(h, 'email', 'e-mail', 'mail', 'courriel', 'بريد');
  const isPhone = has(h, 'tel', 'phone', 'gsm', 'mobile', 'portable', 'هاتف', 'جوال');
  const isCountry = has(h, 'pays', 'country', 'nationalit', 'residence', 'بلد', 'دولة');
  const isLocale = has(h, 'langue', 'lang', 'locale', 'لغة');
  const isName = has(h, 'nom', 'name', 'prenom', 'اسم');

  // Champs porteurs d'un préfixe propriétaire/locataire.
  if (tenant) {
    if (isEmail) return 'tenantEmail';
    if (isPhone) return 'tenantPhone';
    if (isCountry) return 'tenantCountry';
    if (isLocale) return 'tenantLocale';
    if (has(h, 'deleg', 'redevable', 'charge')) return 'tenantDelegated';
    if (isName) return 'tenantName';
    return 'tenantName';
  }
  if (owner) {
    if (isEmail) return 'ownerEmail';
    if (isPhone) return 'ownerPhone';
    if (isCountry) return 'ownerCountry';
    if (isLocale) return 'ownerLocale';
    if (isName) return 'ownerName';
    return 'ownerName';
  }

  // Délégation des charges au locataire, en-tête sans le mot « locataire ».
  if (has(h, 'deleg', 'redevable')) return 'tenantDelegated';

  // Champs du lot.
  if (has(h, 'occupation', 'occupancy', 'mode', 'شغل', 'اشغال')) return 'occupancy';
  if (has(h, 'quote', 'quote-part', 'millieme', 'tantieme', 'part', 'حصة', 'نصيب'))
    return 'quotePart';
  if (has(h, 'charge', 'mensuel', 'cotisation', 'رسوم', 'اشتراك')) return 'charge';
  if (has(h, 'surface', 'superficie', 'm2', 'metre', 'مساحة')) return 'surface';
  if (has(h, 'etage', 'floor', 'niveau', 'طابق', 'دور')) return 'floor';
  if (has(h, 'type', 'nature', 'categorie', 'نوع')) return 'unitType';
  if (has(h, 'reference', 'ref', 'lot', 'numero', 'no ', 'n°', 'العقار', 'مرجع', 'رقم'))
    return 'reference';

  return null;
}

/** Nettoyage minimal d'une cellule texte (trim). Renvoie '' si vide/nullish. */
export function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .trim();
}

/**
 * Parse un montant tolérant → CENTIMES entiers, ou null si illisible/négatif.
 * Gère « 650 », « 650,00 », « 1 200,00 », « 1,200.00 », « 1.200,00 » : espaces
 * (dont insécables) et apostrophes = milliers ; le dernier séparateur , ou . = décimale.
 */
export function parseMoneyToCentimes(raw: string): number | null {
  let s = cell(raw);
  if (s === '') return null;
  s = s.replace(/[\s'\u2019]/g, ''); // milliers : espaces + apostrophes
  s = s.replace(/[^\d.,-]/g, ''); // retire devise/lettres (MAD, dh, …)
  if (s === '' || s === '-') return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let decimalSep: string | null = null;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    // une seule virgule avec ≤2 décimales → décimale ; sinon milliers
    decimalSep = s.indexOf(',') === lastComma && s.length - lastComma - 1 <= 2 ? ',' : null;
  } else if (lastDot >= 0) {
    decimalSep = s.indexOf('.') === lastDot && s.length - lastDot - 1 <= 2 ? '.' : null;
  }

  let normalized: string;
  if (decimalSep) {
    const other = decimalSep === ',' ? /\./g : /,/g;
    normalized = s.replace(other, '').replace(decimalSep, '.');
  } else {
    normalized = s.replace(/[.,]/g, ''); // tous les séparateurs sont des milliers
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Parse un entier tolérant (quote-part, surface) → entier ≥ 0, ou null. */
export function parseIntLoose(raw: string): number | null {
  const s = cell(raw)
    .replace(/[\s'\u2019]/g, '')
    .replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valide un e-mail (souple mais réel). '' → null (absent, pas invalide). */
export function normalizeEmail(raw: string): { ok: true; value: string | null } | { ok: false } {
  const s = cell(raw);
  if (s === '') return { ok: true, value: null };
  if (!EMAIL_RE.test(s)) return { ok: false };
  return { ok: true, value: s };
}

/** Type d'unité → LotType, ou null si inconnu (→ rejet). '' → APPARTEMENT par défaut. */
export function mapUnitType(raw: string): 'APPARTEMENT' | 'VILLA' | null {
  const s = foldText(raw);
  if (s === '') return 'APPARTEMENT';
  if (has(s, 'appart', 'appt', 'apartment', 'flat', 'studio', 'شقة', 'شقه')) return 'APPARTEMENT';
  if (has(s, 'villa', 'maison', 'house', 'duplex', 'فيلا', 'فيلة', 'منزل')) return 'VILLA';
  return null;
}

/** Langue préférée → Locale ('fr' par défaut). */
export function mapLocale(raw: string): 'fr' | 'ar' {
  const s = foldText(raw);
  if (has(s, 'ar', 'arab', 'عرب')) return 'ar';
  return 'fr';
}

/** Mode d'occupation → OccupancyMode, ou null si absent/inconnu (→ déduction). */
export function mapOccupancy(raw: string): 'OWNER_OCCUPIED' | 'RENTED' | 'VACANT' | null {
  const s = foldText(raw);
  if (s === '') return null;
  if (has(s, 'vacant', 'vide', 'libre', 'شاغر', 'فارغ')) return 'VACANT';
  if (has(s, 'loue', 'location', 'rented', 'rent', 'مؤجر', 'مكرى')) return 'RENTED';
  if (has(s, 'propriet', 'owner', 'occupe', 'occupied', 'مالك', 'يسكنه')) return 'OWNER_OCCUPIED';
  return null;
}

const TRUTHY = new Set(['oui', 'yes', 'y', 'true', 'vrai', 'x', '1', 'o', 'ok', 'نعم', 'صحيح']);

/** Booléen tolérant (délégation des charges). Comparaison par jeton, '' → false. */
export function parseBool(raw: string): boolean {
  const s = foldText(raw);
  if (s === '') return false;
  if (TRUTHY.has(s)) return true;
  return s.split(/[^\p{L}\p{N}]+/u).some((t) => TRUTHY.has(t));
}

/** Découpe un nom complet en prénom/nom. Un seul mot → tout en nom. */
export function splitName(raw: string): { firstName: string; lastName: string } {
  const parts = cell(raw).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0]! };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}
