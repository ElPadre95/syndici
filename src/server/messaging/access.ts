/**
 * LE MUR DE LA MESSAGERIE — point de contrôle UNIQUE (G4).
 *
 * Un lot porte jusqu'à deux fils distincts, discriminés par `counterpartyRole` :
 *   - OWNER  : syndic ↔ propriétaire du lot ;
 *   - TENANT : syndic ↔ locataire du lot.
 *
 * Règle d'accès, appliquée ici et NULLE PART AILLEURS (lectures, envoi, service des
 * pièces jointes passent tous par `canAccessConversation`) :
 *   - staff (SYNDIC/GESTIONNAIRE) : tout fil de sa résidence active ;
 *   - PROPRIETAIRE : uniquement le fil OWNER d'un lot qu'il détient (rattachement
 *     OWNER actif) ;
 *   - LOCATAIRE : uniquement le fil TENANT d'un lot qu'il occupe (rattachement
 *     TENANT actif).
 *
 * Conséquence (le mur) : un locataire n'atteint jamais le fil du propriétaire de son
 * lot (ni son existence — on renvoie `null`, pas d'erreur distincte), un propriétaire
 * jamais celui du locataire, et personne un fil d'un lot qui n'est pas le sien.
 * Aucune donnée de `Person` n'est touchée : le mur repose sur `LotAttachment` seul.
 */
import type { SqlExecutor } from '@/server/db/sql';
import type { ActiveContext } from '@/server/auth/context';

export type CounterpartyRole = 'OWNER' | 'TENANT';

export interface ConversationMeta {
  id: string;
  residenceId: string;
  lotId: string | null;
  counterpartyRole: CounterpartyRole;
}

function isStaff(role: ActiveContext['role']): boolean {
  return role === 'SYNDIC' || role === 'GESTIONNAIRE';
}

/** Le rôle résident qui donne accès au fil `counterpartyRole`, ou null pour le staff. */
function residentRoleFor(role: ActiveContext['role']): CounterpartyRole | null {
  if (role === 'PROPRIETAIRE') return 'OWNER';
  if (role === 'LOCATAIRE') return 'TENANT';
  return null;
}

/** La personne détient-elle un rattachement ACTIF du rôle donné sur ce lot ? */
export async function hasActiveAttachment(
  exec: SqlExecutor,
  personId: string,
  residenceId: string,
  lotId: string,
  role: CounterpartyRole,
): Promise<boolean> {
  const rows = await exec.query<{ ok: number }>(
    `SELECT 1 AS ok
       FROM "LotAttachment"
      WHERE "personId" = $1 AND "residenceId" = $2 AND "lotId" = $3
        AND role = $4::"AttachmentRole" AND "endDate" IS NULL
      LIMIT 1`,
    [personId, residenceId, lotId, role],
  );
  return rows.length > 0;
}

/**
 * Le contexte donne-t-il accès à cette conversation ? Renvoie ses métadonnées si oui,
 * `null` sinon (refus indistinct de « n'existe pas » : aucune fuite d'existence).
 * La conversation est d'abord bornée à la résidence active (isolation multi-résidences).
 */
export async function canAccessConversation(
  exec: SqlExecutor,
  ctx: ActiveContext,
  conversationId: string,
): Promise<ConversationMeta | null> {
  const rows = await exec.query<ConversationMeta>(
    `SELECT id, "residenceId", "lotId", "counterpartyRole"
       FROM "Conversation"
      WHERE id = $1 AND "residenceId" = $2
      LIMIT 1`,
    [conversationId, ctx.residenceId],
  );
  const conv = rows[0];
  if (!conv) return null;

  // Staff : tout fil de SA résidence active (le contexte staff est déjà borné au mandat).
  if (isStaff(ctx.role)) return conv;

  // Résident : le fil doit être du bon rôle ET porter sur un lot qu'il détient.
  const need = residentRoleFor(ctx.role);
  if (!need || conv.counterpartyRole !== need || !conv.lotId) return null;
  if (!(await hasActiveAttachment(exec, ctx.personId, ctx.residenceId, conv.lotId, need)))
    return null;
  return conv;
}

/**
 * Peut-on servir la pièce jointe `fileId` à ce contexte ? Vraie SEULEMENT si le fichier
 * est porté par un message d'un fil auquel le contexte a accès. Utilisé par la route de
 * service des fichiers : une pièce jointe n'est jamais servie hors de son fil.
 */
export async function canServeMessageAttachment(
  exec: SqlExecutor,
  ctx: ActiveContext,
  fileId: string,
): Promise<boolean> {
  const rows = await exec.query<{ conversationId: string }>(
    `SELECT "conversationId"
       FROM "Message"
      WHERE "fileAssetId" = $1 AND "residenceId" = $2
      LIMIT 1`,
    [fileId, ctx.residenceId],
  );
  const msg = rows[0];
  if (!msg) return false;
  return (await canAccessConversation(exec, ctx, msg.conversationId)) !== null;
}
