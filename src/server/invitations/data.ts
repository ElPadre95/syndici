/**
 * Suivi des invitations (A6). Scopé à la résidence active via `forResidence` ; les
 * identités passent par person-access. Le statut affiché est DÉRIVÉ (une invitation
 * PENDING dont l'échéance est passée est présentée EXPIRED).
 */
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor } from '@/server/db/sql';
import { getAccessiblePerson } from '@/server/auth/person-access';
import type { ActiveContext } from '@/server/auth/context';

export type InvitationDisplayStatus = 'PENDING' | 'USED' | 'REVOKED' | 'EXPIRED';

export interface InvitationRow {
  id: string;
  role: 'OWNER' | 'TENANT';
  personId: string;
  personName: string | null;
  lotId: string;
  lotReference: string;
  status: InvitationDisplayStatus;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
}

/** Le lot a-t-il un rattachement ACTIF pour cette personne ? (garde d'émission) */
export async function activeAttachmentRole(
  ctx: ActiveContext,
  lotId: string,
  personId: string,
): Promise<'OWNER' | 'TENANT' | null> {
  const a = await forResidence(ctx.residenceId).lotAttachment.findFirst({
    where: { lotId, personId, endDate: null },
    select: { role: true },
  });
  return (a?.role as 'OWNER' | 'TENANT' | undefined) ?? null;
}

function displayStatus(status: string, expiresAt: Date | null, now: Date): InvitationDisplayStatus {
  if (status === 'USED') return 'USED';
  if (status === 'REVOKED') return 'REVOKED';
  if (status === 'EXPIRED') return 'EXPIRED';
  if (expiresAt && expiresAt < now) return 'EXPIRED';
  return 'PENDING';
}

/** Invitations de la résidence active (toutes, ou celles d'un lot), plus récentes d'abord. */
export async function listInvitations(
  ctx: ActiveContext,
  lotId?: string,
  now: Date = new Date(),
): Promise<InvitationRow[]> {
  const rows = await forResidence(ctx.residenceId).invitationCode.findMany({
    where: lotId ? { lotId } : {},
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      role: true,
      personId: true,
      lotId: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      usedAt: true,
      lot: { select: { reference: true } },
    },
  });

  const exec = prismaExecutor();
  const cache = new Map<string, Awaited<ReturnType<typeof getAccessiblePerson>>>();
  const out: InvitationRow[] = [];
  for (const r of rows) {
    if (!cache.has(r.personId))
      cache.set(r.personId, await getAccessiblePerson(exec, ctx, r.personId));
    const person = cache.get(r.personId) ?? null;
    out.push({
      id: r.id,
      role: r.role as 'OWNER' | 'TENANT',
      personId: r.personId,
      personName: person ? `${person.firstName} ${person.lastName}`.trim() : null,
      lotId: r.lotId,
      lotReference: r.lot.reference,
      status: displayStatus(r.status, r.expiresAt, now),
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      usedAt: r.usedAt ? r.usedAt.toISOString() : null,
    });
  }
  return out;
}

/** Révoque une invitation EN ATTENTE (les autres statuts sont inchangés). */
export async function revokeInvitation(ctx: ActiveContext, invitationId: string): Promise<boolean> {
  const res = await forResidence(ctx.residenceId).invitationCode.updateMany({
    where: { id: invitationId, status: 'PENDING' },
    data: { status: 'REVOKED' },
  });
  return res.count > 0;
}

/** Passe à REVOKED toutes les invitations PENDING d'une (personne, lot) — avant réémission. */
export async function revokePendingFor(
  ctx: ActiveContext,
  lotId: string,
  personId: string,
): Promise<void> {
  await forResidence(ctx.residenceId).invitationCode.updateMany({
    where: { lotId, personId, status: 'PENDING' },
    data: { status: 'REVOKED' },
  });
}
