/**
 * Client Prisma « brut » interne — NON destiné à l'usage applicatif direct.
 *
 * L'accès aux données passe par :
 *   - `forResidence(residenceId)` (src/server/db/tenant.ts) pour les modèles scopés ;
 *   - la couche d'accès aux personnes (src/server/auth/person-access.ts) pour la PII.
 *
 * Seuls quelques modules d'INFRASTRUCTURE consomment le client brut : l'exécuteur
 * SQL partagé (src/server/db/sql.ts), la garde tenant (tenant.ts), les créateurs de
 * numéros (finance/numbering.ts) et l'adaptateur Auth.js (server/auth/config.ts).
 * Le code métier ne l'importe jamais. Le modèle des personnes n'est lu que par la
 * couche dédiée (vérifié par un test méta). Construit paresseusement : aucun accès
 * DB à l'import.
 */
import { PrismaClient } from '@prisma/client';

let _client: PrismaClient | null = null;

export function getBaseClient(): PrismaClient {
  return (_client ??= new PrismaClient());
}

export async function disconnectBase(): Promise<void> {
  if (_client) await _client.$disconnect();
  _client = null;
}
