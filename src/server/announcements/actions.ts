'use server';

/**
 * Action de publication d'actualité (E3). Gardée par `can(role, 'announcement.manage')`
 * — staff. Le type et l'audience sont validés contre les listes autorisées.
 */
import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import {
  createAnnouncement,
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_AUDIENCES,
  type AnnouncementType,
  type AnnouncementAudience,
} from './data';
import { getResidenceBasics } from '@/server/residences/data';
import { requestOrigin } from '@/server/mail/links';
import { notifyResidence } from '@/server/mail/notify';
import { announcementEmail } from '@/server/mail/templates';
import { normalizeLocale } from '@/server/mail/i18n';
import type { AnnouncementActionResult } from './action-types';

export async function publishAnnouncementAction(
  formData: FormData,
): Promise<AnnouncementActionResult> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'announcement.manage')) return { ok: false, error: 'forbidden' };

  const type = String(formData.get('type') ?? '') as AnnouncementType;
  const audience = String(formData.get('audience') ?? '') as AnnouncementAudience;
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!ANNOUNCEMENT_TYPES.includes(type)) return { ok: false, error: 'invalid_type' };
  if (!ANNOUNCEMENT_AUDIENCES.includes(audience)) return { ok: false, error: 'invalid_audience' };
  if (!title) return { ok: false, error: 'title_required' };
  if (!body) return { ok: false, error: 'body_required' };

  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  await createAnnouncement(actx, { type, audience, title, body });

  // Notification e-mail (I5) — aux résidents de l'audience visée, dans leur langue. En dev :
  // journalisé, jamais envoyé.
  const residence = await getResidenceBasics(ctx.activeId);
  const origin = await requestOrigin();
  await notifyResidence(actx, {
    audience,
    build: (locale) =>
      announcementEmail(locale, {
        residence: residence?.name ?? '',
        title,
        url: `${origin}/${normalizeLocale(locale)}`,
      }),
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
