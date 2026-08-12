'use server';

/**
 * Actions serveur des invitations (A6). Émission gardée par les autorisations
 * (`invitation.manage`) ET par la présence d'un rattachement ACTIF (impossible
 * d'inviter une personne sans accès — la faille de l'étape 4). Le code n'est
 * renvoyé qu'une fois, jamais restocké en clair. Message WhatsApp dans la langue
 * préférée de la personne.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getSessionContext } from '@/server/session';
import { prismaExecutor } from '@/server/db/sql';
import { can } from '@/server/auth/permissions';
import { getAccessiblePerson } from '@/server/auth/person-access';
import type { ActiveContext } from '@/server/auth/context';
import { createInvitation } from '@/server/auth/invitation';
import { getLot } from '@/server/lots/data';
import { getResidenceBasics } from '@/server/residences/data';
import { activeAttachmentRole, revokeInvitation, revokePendingFor } from './data';
import { whatsappHref } from './whatsapp';
import type { EmitResult } from './types';

function localePath(raw: FormDataEntryValue | null): string {
  const value = typeof raw === 'string' ? raw : '';
  return (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

function resolveLocale(value: string): string {
  return (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

type Inviter = { ctx: ActiveContext } | { error: 'no_active_residence' | 'forbidden' };

async function requireInviter(): Promise<Inviter> {
  const s = await getSessionContext();
  if (!s?.activeId || !s.role) return { error: 'no_active_residence' };
  if (!can(s.role, 'invitation.manage')) return { error: 'forbidden' };
  return { ctx: { personId: s.personId, residenceId: s.activeId, role: s.role } };
}

export async function emitInvitationAction(lotId: string, personId: string): Promise<EmitResult> {
  const mgr = await requireInviter();
  if ('error' in mgr) return { ok: false, reason: mgr.error };
  const { ctx } = mgr;

  // Garde clé : une invitation n'est possible que vers une personne RATTACHÉE ACTIVEMENT.
  const role = await activeAttachmentRole(ctx, lotId, personId);
  if (!role) return { ok: false, reason: 'no_active_attachment' };

  const exec = prismaExecutor();
  const person = await getAccessiblePerson(exec, ctx, personId);
  const lot = await getLot(ctx.residenceId, lotId);
  const residence = await getResidenceBasics(ctx.residenceId);
  if (!person || !lot || !residence) return { ok: false, reason: 'not_found' };

  // Réémission : on révoque les invitations en attente précédentes.
  await revokePendingFor(ctx, lotId, personId);
  const inv = await createInvitation(exec, {
    residenceId: ctx.residenceId,
    lotId,
    personId,
    role,
    createdByPersonId: ctx.personId,
  });

  const personLocale = resolveLocale(person.preferredLocale);
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const activationUrl = `${proto}://${host}/${personLocale}/invite`;
  const expiresLabel = new Intl.DateTimeFormat(personLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(inv.expiresAt);

  const twa = await getTranslations({ locale: personLocale, namespace: 'invitations.wa' });
  const message = twa('message', {
    name: `${person.firstName} ${person.lastName}`.trim(),
    residence: residence.name,
    lotRef: lot.reference,
    code: inv.code,
    url: activationUrl,
    expires: expiresLabel,
  });

  revalidatePath('/', 'layout');
  return {
    ok: true,
    code: inv.code,
    expiresAt: inv.expiresAt.toISOString(),
    waHref: whatsappHref(person.phone, message),
    message,
    lotReference: lot.reference,
  };
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const mgr = await requireInviter();
  if ('error' in mgr) return;
  const invitationId = String(formData.get('invitationId') ?? '');
  if (invitationId) await revokeInvitation(mgr.ctx, invitationId);
  revalidatePath('/', 'layout');
  const back = String(formData.get('back') ?? '');
  redirect(`/${localePath(formData.get('locale'))}${back || '/invitations'}`);
}
