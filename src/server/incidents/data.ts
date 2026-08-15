/**
 * Lectures des incidents (H1). Le fil de suivi, la photo (lien signé C0), et — le point
 * qui ferme la boucle de transparence — la ou les DÉPENSES qui découlent de l'incident.
 * Tout accès à un incident précis passe par `canAccessIncident` (le mur). Aucune donnée de
 * `Person` n'est lue : le « côté » d'un message du fil est déduit en comparant les ids.
 */
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor } from '@/server/db/sql';
import { signedFilePath } from '@/server/storage/sign';
import type { ActiveContext } from '@/server/auth/context';
import { canAccessIncident } from './access';

export type Urgency = 'NORMALE' | 'IMPORTANTE' | 'URGENTE';
export type IncidentStatus = 'NOUVEAU' | 'EN_COURS' | 'RESOLU';

const SEVERITY: Record<Urgency, number> = { URGENTE: 3, IMPORTANTE: 2, NORMALE: 1 };

export interface IncidentListRow {
  id: string;
  category: string;
  location: string;
  urgency: Urgency;
  status: IncidentStatus;
  lotReference: string | null;
  reportedAt: string;
  updateCount: number;
  hasExpense: boolean;
}

export interface IncidentUpdateView {
  id: string;
  kind: 'COMMENT' | 'STATUS_CHANGE' | 'CONTACT';
  message: string | null;
  oldStatus: IncidentStatus | null;
  newStatus: IncidentStatus | null;
  createdAt: string;
  bySyndic: boolean;
}

export interface LinkedExpense {
  id: string;
  description: string;
  amountMinor: number;
  spentOn: string;
  supplierName: string | null;
  justificatifHref: string | null;
}

export interface IncidentDetail {
  id: string;
  category: string;
  location: string;
  description: string;
  urgency: Urgency;
  status: IncidentStatus;
  lotReference: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  photoHref: string | null;
  updates: IncidentUpdateView[];
  expenses: LinkedExpense[];
  isReporter: boolean;
}

/** Tri : urgence décroissante (l'enum n'est pas ordonné par sévérité), puis plus ancien d'abord. */
function bySeverityThenAge(a: IncidentListRow, b: IncidentListRow): number {
  const s = SEVERITY[b.urgency] - SEVERITY[a.urgency];
  return s !== 0 ? s : a.reportedAt.localeCompare(b.reportedAt);
}

type RawIncident = {
  id: string;
  category: string;
  location: string;
  urgency: Urgency;
  status: IncidentStatus;
  reportedAt: Date;
  lot: { reference: string } | null;
  _count: { updates: number; expenses: number };
};

function toRow(i: RawIncident): IncidentListRow {
  return {
    id: i.id,
    category: i.category,
    location: i.location,
    urgency: i.urgency,
    status: i.status,
    lotReference: i.lot?.reference ?? null,
    reportedAt: i.reportedAt.toISOString(),
    updateCount: i._count.updates,
    hasExpense: i._count.expenses > 0,
  };
}

const LIST_SELECT = {
  id: true,
  category: true,
  location: true,
  urgency: true,
  status: true,
  reportedAt: true,
  lot: { select: { reference: true } },
  _count: { select: { updates: true, expenses: true } },
} as const;

/** Tous les incidents de la résidence (staff), triés urgence puis ancienneté. */
export async function listStaffIncidents(ctx: ActiveContext): Promise<IncidentListRow[]> {
  const rows = (await forResidence(ctx.residenceId).incident.findMany({
    select: LIST_SELECT,
  })) as RawIncident[];
  return rows.map(toRow).sort(bySeverityThenAge);
}

/** Incidents visibles d'un propriétaire : ses lots + les parties communes de sa résidence. */
export async function listOwnerIncidents(ctx: ActiveContext): Promise<IncidentListRow[]> {
  const scoped = forResidence(ctx.residenceId);
  const links = await scoped.lotAttachment.findMany({
    where: { personId: ctx.personId, role: 'OWNER', endDate: null },
    select: { lotId: true },
  });
  const lotIds = links.map((l) => l.lotId);
  const rows = (await scoped.incident.findMany({
    where: { OR: [{ lotId: null }, { lotId: { in: lotIds } }] },
    select: LIST_SELECT,
  })) as RawIncident[];
  return rows.map(toRow).sort(bySeverityThenAge);
}

/** Détail d'un incident, après contrôle d'accès (mur). `null` si hors périmètre. */
export async function getIncidentDetail(
  ctx: ActiveContext,
  incidentId: string,
): Promise<IncidentDetail | null> {
  const meta = await canAccessIncident(prismaExecutor(), ctx, incidentId);
  if (!meta) return null;
  const scoped = forResidence(ctx.residenceId);
  const inc = await scoped.incident.findUnique({
    where: { id: incidentId },
    select: {
      id: true,
      category: true,
      location: true,
      description: true,
      urgency: true,
      status: true,
      reportedAt: true,
      resolvedAt: true,
      reportedByPersonId: true,
      photoId: true,
      lot: { select: { reference: true } },
      updates: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          kind: true,
          message: true,
          oldStatus: true,
          newStatus: true,
          createdAt: true,
          authorPersonId: true,
        },
      },
    },
  });
  if (!inc) return null;

  const isStaff = ctx.role === 'SYNDIC' || ctx.role === 'GESTIONNAIRE';
  // Dépenses liées : le propriétaire ne voit jamais l'INTERNE (comme en transparence).
  const expenses = await scoped.expense.findMany({
    where: {
      incidentId,
      reversesExpenseId: null,
      voidedAt: null,
      ...(isStaff ? {} : { visibility: { not: 'INTERNE' } }),
    },
    orderBy: { spentOn: 'desc' },
    select: {
      id: true,
      description: true,
      amountMinor: true,
      spentOn: true,
      supplierName: true,
      justificatifId: true,
    },
  });

  return {
    id: inc.id,
    category: inc.category,
    location: inc.location,
    description: inc.description,
    urgency: inc.urgency,
    status: inc.status,
    lotReference: inc.lot?.reference ?? null,
    reportedAt: inc.reportedAt.toISOString(),
    resolvedAt: inc.resolvedAt?.toISOString() ?? null,
    photoHref: inc.photoId ? signedFilePath(inc.photoId, 3600) : null,
    isReporter: inc.reportedByPersonId === ctx.personId,
    updates: inc.updates.map((u) => ({
      id: u.id,
      kind: u.kind,
      message: u.message,
      oldStatus: u.oldStatus,
      newStatus: u.newStatus,
      createdAt: u.createdAt.toISOString(),
      // « côté » sans lire Person : l'auteur est le déclarant, ou le syndic sinon.
      bySyndic: u.authorPersonId !== inc.reportedByPersonId,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amountMinor: e.amountMinor,
      spentOn: e.spentOn.toISOString(),
      supplierName: e.supplierName,
      justificatifHref: e.justificatifId ? signedFilePath(e.justificatifId, 3600) : null,
    })),
  };
}

/** Dépenses de la résidence non encore reliées à un incident (pour le sélecteur staff). */
export async function listLinkableExpenses(
  ctx: ActiveContext,
): Promise<Array<{ id: string; label: string }>> {
  const rows = await forResidence(ctx.residenceId).expense.findMany({
    where: { incidentId: null, reversesExpenseId: null, voidedAt: null },
    orderBy: { spentOn: 'desc' },
    select: { id: true, description: true, supplierName: true, amountMinor: true },
    take: 50,
  });
  return rows.map((e) => ({
    id: e.id,
    label: `${e.supplierName ?? e.description} — ${(e.amountMinor / 100).toFixed(2)}`,
  }));
}
