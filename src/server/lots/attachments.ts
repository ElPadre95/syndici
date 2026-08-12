/**
 * Rattachements personne ↔ lot (A5). Historisés, jamais supprimés (date de fin
 * uniquement). Un seul propriétaire actif et un seul locataire actif par lot
 * (index partiels en base) ; un chevauchement produit un message clair, pas une
 * erreur technique. Les identités passent par person-access.
 */
import { getBaseClient } from '@/server/db/client';
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor, type SqlExecutor } from '@/server/db/sql';
import {
  createPerson,
  getAccessiblePerson,
  type CreatePersonInput,
} from '@/server/auth/person-access';
import type { ActiveContext } from '@/server/auth/context';

export type AttachRole = 'OWNER' | 'TENANT';

export interface AttachmentRow {
  id: string;
  role: AttachRole;
  personId: string;
  /** Identité seulement si le contexte y donne droit (staff) ; sinon null (étanchéité). */
  personName: string | null;
  personCountry: string | null;
  personAbroad: boolean;
  isChargePayer: boolean;
  startDate: string; // ISO
  endDate: string | null; // ISO ; null = actif
}

function isAbroad(nationality: string | null): boolean {
  if (!nationality) return false;
  const n = nationality.trim().toLowerCase();
  return n !== '' && n !== 'maroc' && n !== 'ma' && n !== 'morocco';
}

/** Historique complet des rattachements d'un lot (actifs + terminés), du plus ancien au plus récent. */
export async function listLotAttachments(
  ctx: ActiveContext,
  lotId: string,
): Promise<AttachmentRow[]> {
  const atts = await forResidence(ctx.residenceId).lotAttachment.findMany({
    where: { lotId },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      personId: true,
      role: true,
      isChargePayer: true,
      startDate: true,
      endDate: true,
    },
  });

  const exec = prismaExecutor();
  const cache = new Map<string, Awaited<ReturnType<typeof getAccessiblePerson>>>();
  const rows: AttachmentRow[] = [];
  for (const a of atts) {
    if (!cache.has(a.personId))
      cache.set(a.personId, await getAccessiblePerson(exec, ctx, a.personId));
    const person = cache.get(a.personId) ?? null;
    rows.push({
      id: a.id,
      role: a.role as AttachRole,
      personId: a.personId,
      personName: person ? `${person.firstName} ${person.lastName}`.trim() : null,
      personCountry: person?.nationality ?? null,
      personAbroad: isAbroad(person?.nationality ?? null),
      isChargePayer: a.isChargePayer,
      startDate: a.startDate.toISOString(),
      endDate: a.endDate ? a.endDate.toISOString() : null,
    });
  }
  return rows;
}

export type AttachResult =
  { ok: true; id: string } | { ok: false; reason: 'overlap' | 'not_found' };

export interface AttachInput {
  lotId: string;
  /** Rattachement d'une personne existante (dédoublonnage MRE)… */
  personId?: string;
  /** …ou création d'une nouvelle personne, DANS LA MÊME transaction (aucun orphelin). */
  newPerson?: CreatePersonInput;
  role: AttachRole;
  isChargePayer: boolean;
  startDate: Date;
}

/**
 * Rattache une personne à un lot. Création de la personne (si nouvelle) ET
 * rattachement dans UNE SEULE transaction : un chevauchement fait tout échouer, sans
 * laisser de personne orpheline en base. Si le locataire devient redevable
 * (délégation), on libère d'abord le redevable actif (le propriétaire), pour
 * respecter l'unicité « un seul redevable actif par lot ». Un rôle déjà occupé
 * activement → `overlap`.
 */
export async function attachPerson(ctx: ActiveContext, input: AttachInput): Promise<AttachResult> {
  if (!input.personId && !input.newPerson) return { ok: false, reason: 'not_found' };
  const lot = await forResidence(ctx.residenceId).lot.findUnique({
    where: { id: input.lotId },
    select: { id: true },
  });
  if (!lot) return { ok: false, reason: 'not_found' };

  try {
    const id = await getBaseClient().$transaction(async (tx) => {
      // Exécuteur SQL transactionnel : la création de la personne (via person-access)
      // partage la transaction, donc un échec ultérieur l'annule aussi.
      const txExec: SqlExecutor = {
        query: <T>(sql: string, params: unknown[] = []) => tx.$queryRawUnsafe<T[]>(sql, ...params),
      };
      const personId = input.personId ?? (await createPerson(txExec, ctx, input.newPerson!));

      if (input.isChargePayer) {
        await tx.lotAttachment.updateMany({
          where: { lotId: input.lotId, endDate: null, isChargePayer: true },
          data: { isChargePayer: false },
        });
      }
      const created = await tx.lotAttachment.create({
        data: {
          residenceId: ctx.residenceId,
          lotId: input.lotId,
          personId,
          role: input.role,
          isChargePayer: input.isChargePayer,
          startDate: input.startDate,
        },
        select: { id: true },
      });
      // Un locataire actif ⇒ le lot est « loué ».
      if (input.role === 'TENANT') {
        await tx.lot.update({ where: { id: input.lotId }, data: { occupancyMode: 'RENTED' } });
      }
      return created.id;
    });
    return { ok: true, id };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: 'overlap' };
    throw e;
  }
}

export type EndResult = { ok: true } | { ok: false; reason: 'not_found' | 'already_ended' };

/** Termine un rattachement (date de fin uniquement, jamais de suppression). */
export async function endAttachment(
  ctx: ActiveContext,
  attachmentId: string,
  endDate: Date,
): Promise<EndResult> {
  const scoped = forResidence(ctx.residenceId);
  const att = await scoped.lotAttachment.findUnique({
    where: { id: attachmentId },
    select: { lotId: true, role: true, endDate: true },
  });
  if (!att) return { ok: false, reason: 'not_found' };
  if (att.endDate) return { ok: false, reason: 'already_ended' };

  await scoped.lotAttachment.update({ where: { id: attachmentId }, data: { endDate } });
  // Départ du locataire ⇒ le lot n'est plus loué (le syndic pourra préciser occupé/vacant).
  if (att.role === 'TENANT') {
    await scoped.lot.update({ where: { id: att.lotId }, data: { occupancyMode: 'VACANT' } });
  }
  return { ok: true };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}
