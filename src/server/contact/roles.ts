/**
 * Rôles déclarables dans le formulaire de contact (J1). Module PUR (aucune dépendance Prisma
 * ni serveur), donc importable côté client — le <select> du formulaire les liste. La couche
 * données et l'action les réutilisent, source unique.
 */
import type { ContactRole } from '@prisma/client';

/** Ordre d'affichage du <select>. */
export const CONTACT_ROLES = ['SYNDIC_PRO', 'SYNDIC_BENEVOLE', 'PROPRIETAIRE'] as const;

export function isContactRole(v: string): v is ContactRole {
  return (CONTACT_ROLES as readonly string[]).includes(v);
}
