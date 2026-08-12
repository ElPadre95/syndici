/**
 * Accueil résident (A7 §1) — strictement informatif. Une personne connectée qui
 * n'est ni syndic ni gestionnaire ne doit PAS voir l'accueil syndic (« créez votre
 * résidence ») : c'est une information fausse. On lui montre seulement ce à quoi
 * elle est rattachée AUJOURD'HUI (résidence, lot, rôle), en lecture seule.
 *
 * Autorisation : la seule donnée renvoyée est celle des rattachements ACTIFS de la
 * personne elle-même (`personId` = l'utilisateur en session). Aucun accès élargi,
 * aucune identité de tiers. L'espace résident complet viendra dans une tranche dédiée.
 */
import { prismaExecutor } from '@/server/db/sql';

export interface ResidentAttachment {
  residence: string;
  lot: string;
  role: 'OWNER' | 'TENANT';
}

/** Rattachements actifs de la personne (ses résidences/lots, son rôle). Vide si aucun. */
export async function listResidentAttachments(personId: string): Promise<ResidentAttachment[]> {
  return prismaExecutor().query<ResidentAttachment>(
    `SELECT r.name AS residence, l.reference AS lot, la.role AS role
       FROM "LotAttachment" la
       JOIN "Lot" l ON l.id = la."lotId"
       JOIN "Residence" r ON r.id = la."residenceId"
      WHERE la."personId" = $1 AND la."endDate" IS NULL
      ORDER BY r.name, l.reference`,
    [personId],
  );
}
