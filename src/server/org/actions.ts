'use server';

/**
 * Gestion des membres du cabinet (F4). Réservée à l'administrateur (`member.manage` =
 * SYNDIC ; un GESTIONNAIRE ne peut PAS gérer les membres). Inviter par e-mail avec un
 * rôle ; retirer un accès = statut ENDED daté (jamais une suppression) ; changer un rôle.
 * Verrou : on ne peut ni retirer ni rétrograder le DERNIER administrateur actif. Toute
 * modification est tracée au journal d'audit.
 */
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { getBaseClient } from '@/server/db/client';
import { prismaExecutor } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { createPerson, findPersonIdByEmail, listOrgMembers } from '@/server/auth/person-access';
import type { ActiveContext } from '@/server/auth/context';
import { getActiveOrganizationId } from './data';
import { isLastActiveAdmin, ASSIGNABLE_ORG_ROLES, type OrgRole } from './members';
import type { MemberActionResult } from './action-types';

type Admin =
  { ok: true; ctx: ActiveContext } | { ok: false; error: 'forbidden' | 'no_active_residence' };

async function requireMemberAdmin(): Promise<Admin> {
  const s = await getSessionContext();
  if (!s?.activeId || !s.role) return { ok: false, error: 'no_active_residence' };
  if (!can(s.role, 'member.manage')) return { ok: false, error: 'forbidden' };
  return { ok: true, ctx: { personId: s.personId, residenceId: s.activeId, role: s.role } };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Tx = Prisma.TransactionClient;
function audit(
  tx: Tx,
  residenceId: string,
  actorPersonId: string,
  action: string,
  entityId: string,
  after: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({
    data: { residenceId, actorPersonId, action, entityType: 'Membership', entityId, after },
  });
}

export async function inviteMemberAction(formData: FormData): Promise<MemberActionResult> {
  const admin = await requireMemberAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };
  const { ctx } = admin;

  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const role = String(formData.get('role') ?? '') as OrgRole;
  if (!firstName || !lastName) return { ok: false, error: 'name_required' };
  if (!email) return { ok: false, error: 'email_required' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'invalid_email' };
  if (!ASSIGNABLE_ORG_ROLES.includes(role)) return { ok: false, error: 'invalid_role' };

  const exec = prismaExecutor();
  const organizationId = await getActiveOrganizationId(exec, ctx.personId, ctx.residenceId);
  if (!organizationId) return { ok: false, error: 'no_organization' };

  const personId =
    (await findPersonIdByEmail(exec, email)) ??
    (await createPerson(exec, ctx, { firstName, lastName, email, preferredLocale: 'fr' }));

  await getBaseClient().$transaction(async (tx) => {
    const membership = await tx.membership.upsert({
      where: { organizationId_personId: { organizationId, personId } },
      create: { organizationId, personId, role, status: 'ACTIVE' },
      update: { role, status: 'ACTIVE', endedAt: null },
      select: { id: true },
    });
    await audit(tx, ctx.residenceId, ctx.personId, 'member.invite', membership.id, { email, role });
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function changeMemberRoleAction(formData: FormData): Promise<MemberActionResult> {
  const admin = await requireMemberAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };
  const { ctx } = admin;
  const membershipId = String(formData.get('membershipId') ?? '');
  const role = String(formData.get('role') ?? '') as OrgRole;
  if (!ASSIGNABLE_ORG_ROLES.includes(role)) return { ok: false, error: 'invalid_role' };

  const exec = prismaExecutor();
  const organizationId = await getActiveOrganizationId(exec, ctx.personId, ctx.residenceId);
  if (!organizationId) return { ok: false, error: 'no_organization' };

  const members = await listOrgMembers(exec, organizationId);
  const target = members.find((m) => m.membershipId === membershipId);
  if (!target) return { ok: false, error: 'not_found' };
  // Rétrograder le dernier admin actif est interdit (le cabinet perdrait son admin).
  if (role !== 'OWNER_ADMIN' && isLastActiveAdmin(members, membershipId)) {
    return { ok: false, error: 'last_admin' };
  }

  await getBaseClient().$transaction(async (tx) => {
    const res = await tx.membership.updateMany({
      where: { id: membershipId, organizationId },
      data: { role },
    });
    if (res.count === 0) throw new Error('membership introuvable');
    await audit(tx, ctx.residenceId, ctx.personId, 'member.role.change', membershipId, { role });
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function removeMemberAction(formData: FormData): Promise<MemberActionResult> {
  const admin = await requireMemberAdmin();
  if (!admin.ok) return { ok: false, error: admin.error };
  const { ctx } = admin;
  const membershipId = String(formData.get('membershipId') ?? '');

  const exec = prismaExecutor();
  const organizationId = await getActiveOrganizationId(exec, ctx.personId, ctx.residenceId);
  if (!organizationId) return { ok: false, error: 'no_organization' };

  const members = await listOrgMembers(exec, organizationId);
  const target = members.find((m) => m.membershipId === membershipId);
  if (!target) return { ok: false, error: 'not_found' };
  // On ne retire jamais le dernier administrateur actif.
  if (isLastActiveAdmin(members, membershipId)) return { ok: false, error: 'last_admin' };

  await getBaseClient().$transaction(async (tx) => {
    const res = await tx.membership.updateMany({
      where: { id: membershipId, organizationId },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    if (res.count === 0) throw new Error('membership introuvable');
    await audit(tx, ctx.residenceId, ctx.personId, 'member.remove', membershipId, {
      status: 'ENDED',
    });
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
