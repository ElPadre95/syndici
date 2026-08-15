/**
 * Accès aux données « résidences » (A2). La `Residence` est l'unité d'isolation
 * tenant : elle n'a pas de `residenceId` propre, on l'interroge donc via le client
 * de base. Les lots (modèle tenant) sont comptés via `forResidence(id)` pour rester
 * derrière la garde. La création d'une résidence est la RACINE d'un tenant : elle
 * précède l'existence du scope, donc elle passe par une transaction du client de
 * base (exception documentée à la règle « partir d'un modèle déjà scopé »).
 */
import { getBaseClient } from '@/server/db/client';
import { forResidence } from '@/server/db/tenant';
import type { ResidenceDraft, ResidenceType } from './validation';

export interface ResidenceListItem {
  id: string;
  name: string;
  city: string | null;
  type: ResidenceType;
  lotCount: number;
  mandateStatus: string | null;
}

/** Résidences gérées par les organisations dont la personne est membre actif. */
export async function listResidencesForPerson(personId: string): Promise<ResidenceListItem[]> {
  const base = getBaseClient();
  const memberships = await base.membership.findMany({
    where: { personId, status: 'ACTIVE' },
    select: { organizationId: true },
  });
  const orgIds = memberships.map((m) => m.organizationId);
  if (orgIds.length === 0) return [];

  const mandates = await base.mandate.findMany({
    where: { organizationId: { in: orgIds } },
    select: { residenceId: true, status: true },
  });
  // Un statut représentatif par résidence (ACTIVE prime sur le reste).
  const statusByResidence = new Map<string, string>();
  for (const m of mandates) {
    const current = statusByResidence.get(m.residenceId);
    if (!current || m.status === 'ACTIVE') statusByResidence.set(m.residenceId, m.status);
  }
  const ids = [...statusByResidence.keys()];
  if (ids.length === 0) return [];

  const residences = await base.residence.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: 'asc' },
  });

  const items: ResidenceListItem[] = [];
  for (const r of residences) {
    const lotCount = await forResidence(r.id).lot.count();
    items.push({
      id: r.id,
      name: r.name,
      city: r.city,
      type: r.type as ResidenceType,
      lotCount,
      mandateStatus: statusByResidence.get(r.id) ?? null,
    });
  }
  return items;
}

/**
 * Résidences par id, nommées (pour le sélecteur d'en-tête). Sert à faire apparaître les
 * résidences d'un PROPRIÉTAIRE (accessibles via rattachement, pas via mandat) dans le
 * sélecteur — le cas MRE multi-résidences. `lotCount`/`mandateStatus` ne concernent que le
 * staff : neutres ici (le sélecteur n'utilise que `id`/`name`).
 */
export async function listNamedResidences(ids: readonly string[]): Promise<ResidenceListItem[]> {
  if (ids.length === 0) return [];
  const base = getBaseClient();
  const residences = await base.residence.findMany({
    where: { id: { in: [...ids] } },
    orderBy: { name: 'asc' },
  });
  return residences.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    type: r.type as ResidenceType,
    lotCount: 0,
    mandateStatus: null,
  }));
}

/** Métadonnées d'une résidence utiles à la génération de lots (A3). */
export async function getResidenceBasics(
  residenceId: string,
): Promise<{ name: string; type: ResidenceType; defaultUnitsCount: number } | null> {
  const r = await getBaseClient().residence.findUnique({
    where: { id: residenceId },
    select: { name: true, type: true, defaultUnitsCount: true },
  });
  return r
    ? { name: r.name, type: r.type as ResidenceType, defaultUnitsCount: r.defaultUnitsCount }
    : null;
}

/** Configuration financière d'une résidence (défauts de charges + jour d'échéance). */
export async function getResidenceChargeConfig(residenceId: string): Promise<{
  defaultChargeApptMinor: number;
  defaultChargeVillaMinor: number;
  dueDayOfMonth: number;
  chargeMode: 'FORFAIT' | 'TANTIEMES';
  monthlyBudgetMinor: number;
} | null> {
  const r = await getBaseClient().residence.findUnique({
    where: { id: residenceId },
    select: {
      defaultChargeApptMinor: true,
      defaultChargeVillaMinor: true,
      dueDayOfMonth: true,
      chargeMode: true,
      monthlyBudgetMinor: true,
    },
  });
  return r ?? null;
}

/** Levée quand la personne n'a pas le droit de créer une résidence. */
export class ResidenceAuthError extends Error {
  constructor() {
    super("Cette personne n'est pas autorisée à créer une résidence.");
    this.name = 'ResidenceAuthError';
  }
}

/**
 * Crée une résidence et ouvre un mandat actif :
 *   - si la personne administre déjà une organisation (OWNER_ADMIN actif), on y
 *     rattache le mandat ;
 *   - si elle n'a AUCUNE organisation, on en crée une et elle en devient
 *     OWNER_ADMIN (remplace l'auto-création du prototype) ;
 *   - si elle est membre SANS être OWNER_ADMIN, la création est refusée
 *     (`ResidenceAuthError`) — c'est le point d'application de l'autorisation pour
 *     cette action de niveau compte.
 * Renvoie l'id de la résidence créée.
 */
export async function createResidence(draft: ResidenceDraft, personId: string): Promise<string> {
  const base = getBaseClient();
  return base.$transaction(async (tx) => {
    const ownerAdmin = await tx.membership.findFirst({
      where: { personId, status: 'ACTIVE', role: 'OWNER_ADMIN' },
      select: { organizationId: true },
    });

    let organizationId: string;
    if (ownerAdmin) {
      organizationId = ownerAdmin.organizationId;
    } else {
      const anyMembership = await tx.membership.findFirst({
        where: { personId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (anyMembership) throw new ResidenceAuthError();
      const org = await tx.organization.create({
        data: { name: 'Mon cabinet', kind: 'INDEPENDENT' },
      });
      await tx.membership.create({
        data: { organizationId: org.id, personId, role: 'OWNER_ADMIN', status: 'ACTIVE' },
      });
      organizationId = org.id;
    }

    const residence = await tx.residence.create({
      data: {
        name: draft.name,
        address: draft.address,
        city: draft.city,
        type: draft.type,
        defaultChargeApptMinor: draft.defaultChargeApptMinor,
        defaultChargeVillaMinor: draft.defaultChargeVillaMinor,
        dueDayOfMonth: draft.dueDayOfMonth,
        defaultUnitsCount: draft.defaultUnitsCount,
      },
      select: { id: true },
    });

    await tx.mandate.create({
      data: {
        organizationId,
        residenceId: residence.id,
        status: 'ACTIVE',
        startDate: new Date(),
      },
    });

    return residence.id;
  });
}
