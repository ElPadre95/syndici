import { auth } from '@/auth';

/**
 * « Demandes » est NOTRE boîte de réception de prospects (vitrine) — pas un écran de syndic.
 * Un client ne doit ni le voir dans la navigation (retiré du modèle) ni y accéder par l'URL.
 * On le réserve à l'équipe Syndici via une liste d'e-mails opérateurs (`OPERATOR_EMAILS`,
 * séparés par des virgules, définie côté hébergeur).
 *
 * Sans liste configurée : on tolère l'accès HORS production (démo locale, développement) ;
 * en production, aucune liste ⇒ personne n'y accède (l'écran reste 404 pour tout le monde).
 */
export async function isOperator(): Promise<boolean> {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? '';
  const operators = (process.env.OPERATOR_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (operators.length > 0) return email !== '' && operators.includes(email);
  return process.env.NODE_ENV !== 'production';
}
