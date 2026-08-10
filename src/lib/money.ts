/**
 * Centralized money handling.
 *
 * RULES (see CONVENTIONS.md / DECISIONS.md):
 *   - Every monetary amount is an INTEGER number of centimes. Never a float, never
 *     a major-unit number. 650 MAD is stored as 65000.
 *   - Formatting is NEVER done by hand in a component. Always go through
 *     `formatMoney` so currency, digits and locale stay consistent.
 *
 * The audited prototype hard-coded "650 MAD" as strings and did float-ish math;
 * this module exists so that can never happen again.
 */

/** ISO 4217 currency for the whole product. */
export const CURRENCY = 'MAD' as const;

/** A monetary amount, expressed as an integer count of centimes (1/100 MAD). */
export type Centimes = number;

/** BCP-47 tag used when the locale is unknown. */
const DEFAULT_LOCALE_TAG = 'fr-MA';

/** Maps an app locale to the BCP-47 tag used for MAD formatting in Morocco. */
const LOCALE_TO_BCP47: Record<string, string> = {
  fr: 'fr-MA',
  ar: 'ar-MA',
  en: 'en-MA',
  nl: 'nl-MA',
  es: 'es-MA',
  de: 'de-MA',
};

function resolveLocaleTag(locale: string): string {
  return LOCALE_TO_BCP47[locale] ?? DEFAULT_LOCALE_TAG;
}

function assertCentimes(centimes: Centimes): void {
  if (!Number.isInteger(centimes)) {
    throw new TypeError(
      `Money amounts must be integer centimes, received: ${centimes}. ` +
        `Do float math elsewhere and convert with toCentimes().`,
    );
  }
}

/**
 * Format an integer centimes amount as a localized MAD currency string.
 * @param centimes integer amount in centimes (e.g. 65000 for 650 MAD)
 * @param locale app locale ('fr' | 'ar' | …); defaults to 'fr'
 */
export function formatMoney(centimes: Centimes, locale = 'fr'): string {
  assertCentimes(centimes);
  const amount = centimes / 100;
  return new Intl.NumberFormat(resolveLocaleTag(locale), {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Convert major units (+ optional centimes) into integer centimes.
 * Rounds to the nearest centime to absorb float input at the boundary.
 * @example toCentimes(650) === 65000
 * @example toCentimes(650, 50) === 65050
 */
export function toCentimes(majorUnits: number, centimes = 0): Centimes {
  return Math.round(majorUnits * 100) + Math.round(centimes);
}

/** Split integer centimes into { dirhams, centimes } for display building blocks. */
export function splitAmount(centimes: Centimes): { dirhams: number; centimes: number } {
  assertCentimes(centimes);
  const sign = centimes < 0 ? -1 : 1;
  const abs = Math.abs(centimes);
  return { dirhams: sign * Math.floor(abs / 100), centimes: abs % 100 };
}

/** Sum a list of centimes amounts safely (all integers in, integer out). */
export function sumMoney(amounts: readonly Centimes[]): Centimes {
  return amounts.reduce((total, amount) => {
    assertCentimes(amount);
    return total + amount;
  }, 0);
}
