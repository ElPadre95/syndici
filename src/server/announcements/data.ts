/**
 * Actualités (E3). Le syndic publie vers les résidents d'une résidence avec un TYPE et
 * une AUDIENCE (tous / propriétaires / locataires). Le résident ne voit que ce qui le
 * concerne : la fonction d'audience `audiencesFor` (PURE, testée) est le seul filtre.
 */
import { forResidence } from '@/server/db/tenant';
import type { AppRole } from '@/server/auth/permissions';
import type { ActiveContext } from '@/server/auth/context';

export type AnnouncementType = 'INFORMATION' | 'TRAVAUX' | 'URGENT' | 'REUNION';
export type AnnouncementAudience = 'ALL' | 'OWNERS' | 'TENANTS';

/** Types proposés à la publication (SPEC : information, travaux, urgence, réunion). */
export const ANNOUNCEMENT_TYPES: readonly AnnouncementType[] = [
  'INFORMATION',
  'TRAVAUX',
  'URGENT',
  'REUNION',
];
export const ANNOUNCEMENT_AUDIENCES: readonly AnnouncementAudience[] = ['ALL', 'OWNERS', 'TENANTS'];

/**
 * Audiences qu'un rôle a le droit de VOIR. Un propriétaire voit `ALL`+`OWNERS`, un
 * locataire `ALL`+`TENANTS`, le staff voit tout. PURE.
 */
export function audiencesFor(role: AppRole): AnnouncementAudience[] {
  if (role === 'PROPRIETAIRE') return ['ALL', 'OWNERS'];
  if (role === 'LOCATAIRE') return ['ALL', 'TENANTS'];
  return ['ALL', 'OWNERS', 'TENANTS']; // SYNDIC / GESTIONNAIRE
}

export interface AnnouncementView {
  id: string;
  type: string;
  audience: AnnouncementAudience;
  title: string;
  body: string;
  publishedAt: string;
}

function toView(a: {
  id: string;
  type: string;
  audience: string;
  title: string;
  body: string;
  publishedAt: Date;
}): AnnouncementView {
  return {
    id: a.id,
    type: a.type,
    audience: a.audience as AnnouncementAudience,
    title: a.title,
    body: a.body,
    publishedAt: a.publishedAt.toISOString(),
  };
}

const SELECT = {
  id: true,
  type: true,
  audience: true,
  title: true,
  body: true,
  publishedAt: true,
} as const;

/** Actualités que le résident (rôle courant) a le droit de voir, plus récentes d'abord. */
export async function listAnnouncementsForResident(
  ctx: ActiveContext,
): Promise<AnnouncementView[]> {
  const rows = await forResidence(ctx.residenceId).announcement.findMany({
    where: { audience: { in: audiencesFor(ctx.role) } },
    orderBy: { publishedAt: 'desc' },
    select: SELECT,
  });
  return rows.map(toView);
}

/** Toutes les actualités de la résidence (staff), plus récentes d'abord. */
export async function listAnnouncements(ctx: ActiveContext): Promise<AnnouncementView[]> {
  const rows = await forResidence(ctx.residenceId).announcement.findMany({
    orderBy: { publishedAt: 'desc' },
    select: SELECT,
  });
  return rows.map(toView);
}

export interface CreateAnnouncementInput {
  type: AnnouncementType;
  audience: AnnouncementAudience;
  title: string;
  body: string;
}

/** Publie une actualité (staff). */
export async function createAnnouncement(
  ctx: ActiveContext,
  input: CreateAnnouncementInput,
): Promise<string> {
  const created = await forResidence(ctx.residenceId).announcement.create({
    data: {
      residenceId: ctx.residenceId,
      type: input.type,
      audience: input.audience,
      title: input.title,
      body: input.body,
      publishedByPersonId: ctx.personId,
    },
    select: { id: true },
  });
  return created.id;
}
