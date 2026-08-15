'use server';

/**
 * Actions de la messagerie (G4). Envoyer un message (avec pièce jointe optionnelle),
 * ouvrir un fil, marquer comme lu. Chaque action REVALIDE l'accès au fil via le mur
 * (`canAccessConversation` / la détention du lot) — jamais de confiance à l'entrée.
 * La pièce jointe passe par la couche de stockage existante (`storeFile`, bucket
 * « messages ») ; son service est re-gardé au niveau du fil (route /api/files).
 */
import { revalidatePath } from 'next/cache';
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import type { ActiveContext } from '@/server/auth/context';
import { storeFile } from '@/server/storage/files';
import { canAccessConversation, hasActiveAttachment, type CounterpartyRole } from './access';
import {
  getOrCreateConversationId,
  getThread,
  openResidentThreadByLot,
  markThreadRead,
  listResidentThreads,
  listSyndicThreads,
  type ThreadView,
  type Inbox,
} from './data';

async function activeCtx(): Promise<ActiveContext | null> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return null;
  return { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
}

function isStaff(role: ActiveContext['role']): boolean {
  return role === 'SYNDIC' || role === 'GESTIONNAIRE';
}

function residentRole(role: ActiveContext['role']): CounterpartyRole | null {
  if (role === 'PROPRIETAIRE') return 'OWNER';
  if (role === 'LOCATAIRE') return 'TENANT';
  return null;
}

export type SendMessageResult =
  | { ok: true }
  | { ok: false; error: 'unauthenticated' | 'forbidden' | 'empty' | 'attachment' };

/**
 * Envoie un message. Résident : cible SON lot (`lotId`) — le fil est créé au besoin ;
 * staff : cible un fil existant (`conversationId`). Le côté (`senderSide`) est déduit du
 * rôle, jamais fourni par le client.
 */
export async function sendMessageAction(formData: FormData): Promise<SendMessageResult> {
  const ctx = await activeCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };

  const body = String(formData.get('body') ?? '').trim();
  const file = formData.get('file');
  const hasFile = file instanceof File && file.size > 0;
  if (body === '' && !hasFile) return { ok: false, error: 'empty' };

  // Résoudre le fil + le côté, en revalidant l'accès (le mur).
  let conversationId: string;
  let senderSide: 'GERANT' | 'RESIDENT';
  if (isStaff(ctx.role)) {
    conversationId = String(formData.get('conversationId') ?? '');
    if (!(await canAccessConversation(prismaExecutor(), ctx, conversationId)))
      return { ok: false, error: 'forbidden' };
    senderSide = 'GERANT';
  } else {
    const role = residentRole(ctx.role);
    const lotId = String(formData.get('lotId') ?? '');
    if (!role || !lotId) return { ok: false, error: 'forbidden' };
    if (!(await hasActiveAttachment(prismaExecutor(), ctx.personId, ctx.residenceId, lotId, role)))
      return { ok: false, error: 'forbidden' };
    conversationId = await getOrCreateConversationId(ctx.residenceId, lotId, role);
    senderSide = 'RESIDENT';
  }

  // Pièce jointe optionnelle (bucket « messages », scopé résidence).
  let fileAssetId: string | null = null;
  if (hasFile) {
    const buf = Buffer.from(await file.arrayBuffer());
    const stored = await storeFile(
      { residenceId: ctx.residenceId },
      {
        bucket: 'messages',
        body: buf,
        mimeType: file.type || 'application/octet-stream',
        originalName: file.name || null,
        uploadedByPersonId: ctx.personId,
      },
    );
    if (!stored.ok) return { ok: false, error: 'attachment' };
    fileAssetId = stored.id;
  }

  await forResidence(ctx.residenceId).message.create({
    data: {
      residenceId: ctx.residenceId,
      conversationId,
      senderPersonId: ctx.personId,
      senderSide,
      body: body === '' ? '' : body,
      fileAssetId,
    },
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Boîte de réception du contexte courant : fils du résident, ou conversations du staff. */
export async function loadInboxAction(): Promise<Inbox> {
  const ctx = await activeCtx();
  if (!ctx) return { kind: 'none' };
  if (isStaff(ctx.role)) return { kind: 'staff', threads: await listSyndicThreads(ctx) };
  if (residentRole(ctx.role)) return { kind: 'resident', threads: await listResidentThreads(ctx) };
  return { kind: 'none' };
}

/** Ouvre un fil et le marque comme lu. Résident : par `lotId` ; staff : par `conversationId`. */
export async function openThreadAction(input: {
  lotId?: string;
  conversationId?: string;
}): Promise<ThreadView | null> {
  const ctx = await activeCtx();
  if (!ctx) return null;

  let thread: ThreadView | null;
  if (isStaff(ctx.role)) {
    if (!input.conversationId) return null;
    thread = await getThread(ctx, input.conversationId);
  } else {
    if (!input.lotId) return null;
    thread = await openResidentThreadByLot(ctx, input.lotId);
  }
  if (thread) {
    await markThreadRead(ctx, thread.conversationId);
    revalidatePath('/', 'layout');
  }
  return thread;
}
