'use server';

/**
 * Action de relance (E2). Trace une relance WhatsApp (intention d'envoi) pour un lot. Le
 * destinataire et la règle sont DÉRIVÉS côté serveur (jamais confiés au client) : on ne
 * fait confiance qu'au `lotId` et au texte. Gardé par `can(role, 'reminder.manage')`.
 */
import { revalidatePath } from 'next/cache';
import { forResidence } from '@/server/db/tenant';
import { prismaTxRunner } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { can, type AppRole } from '@/server/auth/permissions';
import { writeReminder } from './reminders';
import type { ReminderActionResult } from './reminder-action-types';

type Manager =
  | { ok: true; ctx: { personId: string; residenceId: string; role: AppRole } }
  | { ok: false; error: 'forbidden' | 'no_active_residence' };

async function requireReminderManager(): Promise<Manager> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'reminder.manage')) return { ok: false, error: 'forbidden' };
  return { ok: true, ctx: { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role } };
}

export async function recordReminderAction(formData: FormData): Promise<ReminderActionResult> {
  const rec = await requireReminderManager();
  if (!rec.ok) return { ok: false, error: rec.error };

  const lotId = String(formData.get('lotId') ?? '');
  const message = String(formData.get('message') ?? '').trim();
  if (!message) return { ok: false, error: 'empty_message' };

  const scoped = forResidence(rec.ctx.residenceId);
  const lot = await scoped.lot.findUnique({ where: { id: lotId }, select: { id: true } });
  if (!lot) return { ok: false, error: 'not_found' };

  // Destinataire (redevable) et règle active — dérivés côté serveur.
  const [payer, rule] = await Promise.all([
    scoped.lotAttachment.findFirst({
      where: { lotId, endDate: null, isChargePayer: true },
      select: { personId: true },
    }),
    scoped.reminderRule.findFirst({
      where: { active: true },
      orderBy: { version: 'desc' },
      select: { id: true },
    }),
  ]);

  await writeReminder(prismaTxRunner(), {
    residenceId: rec.ctx.residenceId,
    lotId,
    recipientPersonId: payer?.personId ?? null,
    reminderRuleId: rule?.id ?? null,
    message,
    sentByPersonId: rec.ctx.personId,
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Trace une MISE EN DEMEURE (I4) : étape formelle du recouvrement, canal COURRIER (lettre
 * imprimée/envoyée). Même dérivation serveur du destinataire et de la règle. On persiste le
 * texte de la lettre comme preuve. Gardé par `reminder.manage`.
 */
export async function recordFormalNoticeAction(formData: FormData): Promise<ReminderActionResult> {
  const rec = await requireReminderManager();
  if (!rec.ok) return { ok: false, error: rec.error };

  const lotId = String(formData.get('lotId') ?? '');
  const message = String(formData.get('message') ?? '').trim();
  if (!message) return { ok: false, error: 'empty_message' };

  const scoped = forResidence(rec.ctx.residenceId);
  const lot = await scoped.lot.findUnique({ where: { id: lotId }, select: { id: true } });
  if (!lot) return { ok: false, error: 'not_found' };

  const [payer, rule] = await Promise.all([
    scoped.lotAttachment.findFirst({
      where: { lotId, endDate: null, isChargePayer: true },
      select: { personId: true },
    }),
    scoped.reminderRule.findFirst({
      where: { active: true },
      orderBy: { version: 'desc' },
      select: { id: true },
    }),
  ]);

  await writeReminder(prismaTxRunner(), {
    residenceId: rec.ctx.residenceId,
    lotId,
    recipientPersonId: payer?.personId ?? null,
    reminderRuleId: rule?.id ?? null,
    message,
    sentByPersonId: rec.ctx.personId,
    kind: 'MISE_EN_DEMEURE',
    channel: 'COURRIER',
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
