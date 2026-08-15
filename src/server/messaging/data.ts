/**
 * Lectures de la messagerie (G4). Un fil, ses messages horodatés, ses pièces jointes,
 * le compteur de non-lus. TOUT accès à un fil précis passe par `canAccessConversation`
 * (le mur, cf. access.ts) : ces lectures ne renvoient jamais un fil hors périmètre.
 * Aucune donnée de `Person` n'est lue ici — le mur repose sur `LotAttachment`.
 */
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor } from '@/server/db/sql';
import { signedFilePath } from '@/server/storage/sign';
import type { ActiveContext } from '@/server/auth/context';
import { canAccessConversation, type CounterpartyRole } from './access';

/** Le rôle d'interlocuteur d'un résident (propriétaire → OWNER, locataire → TENANT). */
function residentRole(role: ActiveContext['role']): CounterpartyRole | null {
  if (role === 'PROPRIETAIRE') return 'OWNER';
  if (role === 'LOCATAIRE') return 'TENANT';
  return null;
}

export interface MessageView {
  id: string;
  side: 'GERANT' | 'RESIDENT';
  body: string;
  sentAt: string;
  // `href` : chemin signé C0 (service re-gardé au niveau du fil). Généré côté serveur —
  // le client ne reçoit qu'un lien à durée limitée, jamais l'URL de stockage.
  attachment: { id: string; name: string | null; mime: string | null; href: string } | null;
}

export interface ThreadView {
  conversationId: string;
  lotId: string | null;
  lotReference: string | null;
  counterpartyRole: CounterpartyRole;
  messages: MessageView[];
}

/** Un fil listé dans une boîte de réception : dernier message + non-lus. */
export interface ThreadSummary {
  conversationId: string | null; // null = pas encore de fil (aucun message échangé)
  lotId: string;
  lotReference: string;
  counterpartyRole: CounterpartyRole;
  unread: number;
  lastBody: string | null;
  lastAt: string | null;
}

const LAST_BODY = `(SELECT m2.body FROM "Message" m2 WHERE m2."conversationId" = c.id ORDER BY m2."sentAt" DESC LIMIT 1)`;
const LAST_AT = `(SELECT m2."sentAt" FROM "Message" m2 WHERE m2."conversationId" = c.id ORDER BY m2."sentAt" DESC LIMIT 1)`;

/**
 * Boîte de réception d'un résident : un fil par lot qu'il détient/occupe (avec le rôle
 * correspondant). Le fil peut ne pas exister encore (`conversationId` null) — il naîtra
 * au premier message. `unread` compte les messages du SYNDIC non lus.
 */
export async function listResidentThreads(ctx: ActiveContext): Promise<ThreadSummary[]> {
  const role = residentRole(ctx.role);
  if (!role) return [];
  const exec = prismaExecutor();
  return exec.query<ThreadSummary>(
    `SELECT l.id AS "lotId", l.reference AS "lotReference",
            c.id AS "conversationId", $3::text AS "counterpartyRole",
            COALESCE((SELECT count(*) FROM "Message" m
                        WHERE m."conversationId" = c.id
                          AND m."senderSide" = 'GERANT' AND m."readAt" IS NULL), 0)::int AS unread,
            ${LAST_BODY} AS "lastBody",
            ${LAST_AT}::text AS "lastAt"
       FROM "LotAttachment" la
       JOIN "Lot" l ON l.id = la."lotId"
       LEFT JOIN "Conversation" c
         ON c."lotId" = l.id AND c."residenceId" = $2 AND c."counterpartyRole" = $3::"AttachmentRole"
      WHERE la."personId" = $1 AND la."residenceId" = $2
        AND la.role = $3::"AttachmentRole" AND la."endDate" IS NULL
      ORDER BY l.reference`,
    [ctx.personId, ctx.residenceId, role],
  );
}

/** Boîte de réception du contexte courant : soit les fils d'un résident, soit ceux du staff. */
export type Inbox =
  | { kind: 'resident'; threads: ThreadSummary[] }
  | { kind: 'staff'; threads: SyndicThread[] }
  | { kind: 'none' };

/** Une conversation listée côté syndic : le lot, le rôle de l'interlocuteur, les non-lus. */
export interface SyndicThread {
  conversationId: string;
  lotId: string | null;
  lotReference: string | null;
  counterpartyRole: CounterpartyRole;
  unread: number;
  lastBody: string | null;
  lastAt: string | null;
}

/** Toutes les conversations de la résidence active (staff), groupées par lot. */
export async function listSyndicThreads(ctx: ActiveContext): Promise<SyndicThread[]> {
  if (ctx.role !== 'SYNDIC' && ctx.role !== 'GESTIONNAIRE') return [];
  const exec = prismaExecutor();
  return exec.query<SyndicThread>(
    `SELECT c.id AS "conversationId", c."lotId", l.reference AS "lotReference",
            c."counterpartyRole"::text AS "counterpartyRole",
            COALESCE((SELECT count(*) FROM "Message" m
                        WHERE m."conversationId" = c.id
                          AND m."senderSide" = 'RESIDENT' AND m."readAt" IS NULL), 0)::int AS unread,
            ${LAST_BODY} AS "lastBody",
            ${LAST_AT}::text AS "lastAt"
       FROM "Conversation" c
       LEFT JOIN "Lot" l ON l.id = c."lotId"
      WHERE c."residenceId" = $1
      ORDER BY l.reference NULLS LAST, c."counterpartyRole"`,
    [ctx.residenceId],
  );
}

/** Compteur de non-lus adapté au rôle (pour la pastille de la bulle). */
export async function unreadCount(ctx: ActiveContext): Promise<number> {
  const exec = prismaExecutor();
  if (ctx.role === 'SYNDIC' || ctx.role === 'GESTIONNAIRE') {
    const rows = await exec.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "Message"
        WHERE "residenceId" = $1 AND "senderSide" = 'RESIDENT' AND "readAt" IS NULL`,
      [ctx.residenceId],
    );
    return rows[0]?.n ?? 0;
  }
  const role = residentRole(ctx.role);
  if (!role) return 0;
  const rows = await exec.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM "Message" m
       JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE m."residenceId" = $1 AND m."senderSide" = 'GERANT' AND m."readAt" IS NULL
        AND c."counterpartyRole" = $3::"AttachmentRole"
        AND c."lotId" IN (
          SELECT "lotId" FROM "LotAttachment"
           WHERE "personId" = $2 AND "residenceId" = $1
             AND role = $3::"AttachmentRole" AND "endDate" IS NULL)`,
    [ctx.residenceId, ctx.personId, role],
  );
  return rows[0]?.n ?? 0;
}

/** Charge les messages d'un fil, après contrôle d'accès. `null` si le fil est hors mur. */
export async function getThread(
  ctx: ActiveContext,
  conversationId: string,
): Promise<ThreadView | null> {
  const meta = await canAccessConversation(prismaExecutor(), ctx, conversationId);
  if (!meta) return null;
  return loadThread(ctx, meta.id, meta.lotId, meta.counterpartyRole);
}

/**
 * Ouvre le fil d'un résident PAR LOT : vérifie qu'il détient/occupe le lot, crée le fil
 * s'il n'existe pas encore, renvoie ses messages. Réservé aux résidents (le staff ouvre
 * par `conversationId`).
 */
export async function openResidentThreadByLot(
  ctx: ActiveContext,
  lotId: string,
): Promise<ThreadView | null> {
  const role = residentRole(ctx.role);
  if (!role) return null;
  const scoped = forResidence(ctx.residenceId);
  const owns = await scoped.lotAttachment.findFirst({
    where: { lotId, personId: ctx.personId, role, endDate: null },
    select: { id: true },
  });
  if (!owns) return null;
  const conversationId = await getOrCreateConversationId(ctx.residenceId, lotId, role);
  const lot = await scoped.lot.findUnique({ where: { id: lotId }, select: { reference: true } });
  return loadThread(ctx, conversationId, lotId, role, lot?.reference ?? null);
}

/** Crée (ou retrouve) le fil (résidence, lot, rôle) — unicité garantie par l'index. */
export async function getOrCreateConversationId(
  residenceId: string,
  lotId: string,
  role: CounterpartyRole,
): Promise<string> {
  const scoped = forResidence(residenceId);
  const existing = await scoped.conversation.findFirst({
    where: { lotId, counterpartyRole: role },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await scoped.conversation.create({
    data: { residenceId, lotId, counterpartyRole: role },
    select: { id: true },
  });
  return created.id;
}

async function loadThread(
  ctx: ActiveContext,
  conversationId: string,
  lotId: string | null,
  counterpartyRole: CounterpartyRole,
  lotReference?: string | null,
): Promise<ThreadView> {
  const scoped = forResidence(ctx.residenceId);
  const rows = await scoped.message.findMany({
    where: { conversationId },
    orderBy: { sentAt: 'asc' },
    select: {
      id: true,
      senderSide: true,
      body: true,
      sentAt: true,
      attachment: { select: { id: true, originalName: true, mimeType: true } },
    },
  });
  let reference = lotReference ?? null;
  if (reference === undefined || (reference === null && lotId)) {
    const lot = lotId
      ? await scoped.lot.findUnique({ where: { id: lotId }, select: { reference: true } })
      : null;
    reference = lot?.reference ?? null;
  }
  return {
    conversationId,
    lotId,
    lotReference: reference,
    counterpartyRole,
    messages: rows.map((m) => ({
      id: m.id,
      side: m.senderSide,
      body: m.body,
      sentAt: m.sentAt.toISOString(),
      attachment: m.attachment
        ? {
            id: m.attachment.id,
            name: m.attachment.originalName,
            mime: m.attachment.mimeType,
            href: signedFilePath(m.attachment.id, 3600),
          }
        : null,
    })),
  };
}

/**
 * Marque comme lus les messages de l'AUTRE partie dans un fil (après contrôle d'accès).
 * Résident : les messages du syndic ; staff : ceux du résident.
 */
export async function markThreadRead(ctx: ActiveContext, conversationId: string): Promise<void> {
  const meta = await canAccessConversation(prismaExecutor(), ctx, conversationId);
  if (!meta) return;
  const otherSide = ctx.role === 'SYNDIC' || ctx.role === 'GESTIONNAIRE' ? 'RESIDENT' : 'GERANT';
  await forResidence(ctx.residenceId).message.updateMany({
    where: { conversationId, senderSide: otherSide, readAt: null },
    data: { readAt: new Date() },
  });
}
