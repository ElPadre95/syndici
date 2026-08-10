import { defineRouting } from 'next-intl/routing';

/**
 * Single source of truth for locales.
 *
 * Only fr (default) and ar ship now. en/nl/es/de are declared as PLANNED so the
 * shape is ready: adding one later means adding it to `plannedLocales`, moving it
 * into `locales`, and dropping a `messages/<locale>.json` — no refactor.
 */
export const plannedLocales = ['en', 'nl', 'es', 'de'] as const;

export const routing = defineRouting({
  locales: ['fr', 'ar'],
  defaultLocale: 'fr',
  // Always prefix the URL with the locale (/fr, /ar) so the active locale is explicit.
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

/** Locales that render right-to-left. */
export const rtlLocales = ['ar'] as const;

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return (rtlLocales as readonly string[]).includes(locale) ? 'rtl' : 'ltr';
}
