/**
 * Origine absolue de l'application (I5) pour construire des liens dans les e-mails. Dérivée
 * des en-têtes de la requête (comme l'activation d'invitation), donc aucune variable d'URL de
 * base n'est requise. À utiliser uniquement dans un contexte de requête (actions serveur).
 */
import { headers } from 'next/headers';

export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
