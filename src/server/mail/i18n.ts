/**
 * Traducteur des e-mails (I5) INDÉPENDANT du contexte de requête. `getTranslations` de
 * next-intl suppose une requête sous `/[locale]` ; or un e-mail peut partir hors de ce
 * contexte (route d'auth `/api/auth`, tâche de fond). On charge donc directement le catalogue
 * `messages/<locale>.json` et on crée un traducteur pour le namespace `mail`.
 */
import { createTranslator } from 'next-intl';

export type MailLocale = 'fr' | 'ar';

/** Ramène une préférence de langue à une locale supportée (défaut : fr). */
export function normalizeLocale(v: string | null | undefined): MailLocale {
  return v === 'ar' ? 'ar' : 'fr';
}

/** Traducteur du namespace `mail` pour la locale donnée (catalogue chargé à la volée). */
export async function mailT(locale: string): Promise<(key: string, values?: Record<string, string | number>) => string> {
  const l = normalizeLocale(locale);
  const messages = (await import(`../../../messages/${l}.json`)).default;
  const t = createTranslator({ locale: l, messages, namespace: 'mail' });
  return (key: string, values?: Record<string, string | number>) =>
    // Le namespace est fixé ; les clés sont contrôlées par les gabarits (templates.ts).
    (t as unknown as (k: string, v?: Record<string, string | number>) => string)(key, values);
}
