/**
 * Accès aux données « lots » (A3), scopé à la résidence active via `forResidence`
 * (barrière tenant). Génération en série idempotente, CRUD unitaire, archivage
 * plutôt que suppression dès qu'un historique existe, total des quotes-parts.
 */
import { getBaseClient } from '@/server/db/client';
import { forResidence } from '@/server/db/tenant';
import { planGeneration, type GeneratedLot, type GroupSpec, type LotType } from './generation';
import type { LotDraft } from './validation';

export interface LotRow {
  id: string;
  reference: string;
  type: LotType;
  floor: string | null;
  surfaceM2: number | null;
  quotePart: number;
  monthlyChargeMinor: number;
}

export class LotConflictError extends Error {
  constructor(public reference: string) {
    super(`Référence en conflit : ${reference}`);
    this.name = 'LotConflictError';
  }
}

async function residenceDefaultCharge(residenceId: string, type: LotType): Promise<number> {
  const r = await getBaseClient().residence.findUnique({
    where: { id: residenceId },
    select: { defaultChargeApptMinor: true, defaultChargeVillaMinor: true },
  });
  if (!r) return 0;
  return type === 'VILLA' ? r.defaultChargeVillaMinor : r.defaultChargeApptMinor;
}

/** Lots actifs (non archivés) de la résidence, triés par référence. */
export async function listLots(residenceId: string): Promise<LotRow[]> {
  const lots = await forResidence(residenceId).lot.findMany({
    where: { archivedAt: null },
    orderBy: { reference: 'asc' },
    select: {
      id: true,
      reference: true,
      type: true,
      floor: true,
      surfaceM2: true,
      quotePart: true,
      monthlyChargeMinor: true,
    },
  });
  return lots.map((l) => ({ ...l, type: l.type as LotType }));
}

/** Somme des quotes-parts des lots actifs (convention : cible 1000). */
export async function quotePartTotal(residenceId: string): Promise<number> {
  const agg = await forResidence(residenceId).lot.aggregate({
    _sum: { quotePart: true },
    where: { archivedAt: null },
  });
  return agg._sum.quotePart ?? 0;
}

/** Toutes les références (archivées comprises : l'unicité DB les inclut). */
async function allReferences(residenceId: string): Promise<string[]> {
  const rows = await forResidence(residenceId).lot.findMany({ select: { reference: true } });
  return rows.map((r) => r.reference);
}

export async function previewGeneration(residenceId: string, groups: GroupSpec[]) {
  return planGeneration(groups, await allReferences(residenceId));
}

export interface GenerationResult {
  created: number;
  conflicts: string[];
  duplicatesWithin: string[];
}

/** Crée les lots planifiés (idempotent : les références existantes sont ignorées). */
export async function generateLots(
  residenceId: string,
  groups: GroupSpec[],
): Promise<GenerationResult> {
  const plan = await previewGeneration(residenceId, groups);
  if (plan.toCreate.length === 0) {
    return { created: 0, conflicts: plan.conflicts, duplicatesWithin: plan.duplicatesWithin };
  }
  const apptCharge = await residenceDefaultCharge(residenceId, 'APPARTEMENT');
  const villaCharge = await residenceDefaultCharge(residenceId, 'VILLA');
  const data = plan.toCreate.map((l: GeneratedLot) => ({
    residenceId,
    reference: l.reference,
    type: l.type,
    floor: l.floor,
    monthlyChargeMinor: l.type === 'VILLA' ? villaCharge : apptCharge,
  }));
  const res = await forResidence(residenceId).lot.createMany({ data, skipDuplicates: true });
  return { created: res.count, conflicts: plan.conflicts, duplicatesWithin: plan.duplicatesWithin };
}

export async function createLot(residenceId: string, draft: LotDraft): Promise<string> {
  const charge =
    draft.monthlyChargeMinor ?? (await residenceDefaultCharge(residenceId, draft.type));
  try {
    const lot = await forResidence(residenceId).lot.create({
      data: {
        residenceId,
        reference: draft.reference,
        type: draft.type,
        floor: draft.floor,
        surfaceM2: draft.surfaceM2,
        quotePart: draft.quotePart,
        monthlyChargeMinor: charge,
      },
      select: { id: true },
    });
    return lot.id;
  } catch (e) {
    if (isUniqueViolation(e)) throw new LotConflictError(draft.reference);
    throw e;
  }
}

export async function getLot(residenceId: string, lotId: string): Promise<LotRow | null> {
  const l = await forResidence(residenceId).lot.findUnique({
    where: { id: lotId },
    select: {
      id: true,
      reference: true,
      type: true,
      floor: true,
      surfaceM2: true,
      quotePart: true,
      monthlyChargeMinor: true,
      archivedAt: true,
    },
  });
  if (!l || l.archivedAt) return null;
  return {
    id: l.id,
    reference: l.reference,
    type: l.type as LotType,
    floor: l.floor,
    surfaceM2: l.surfaceM2,
    quotePart: l.quotePart,
    monthlyChargeMinor: l.monthlyChargeMinor,
  };
}

export async function updateLot(
  residenceId: string,
  lotId: string,
  draft: LotDraft,
): Promise<void> {
  const charge =
    draft.monthlyChargeMinor ?? (await residenceDefaultCharge(residenceId, draft.type));
  try {
    await forResidence(residenceId).lot.update({
      where: { id: lotId },
      data: {
        reference: draft.reference,
        type: draft.type,
        floor: draft.floor,
        surfaceM2: draft.surfaceM2,
        quotePart: draft.quotePart,
        monthlyChargeMinor: charge,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new LotConflictError(draft.reference);
    throw e;
  }
}

/** Un lot a-t-il un historique (rattachement ou écriture financière) ? */
export async function lotHasHistory(residenceId: string, lotId: string): Promise<boolean> {
  const scoped = forResidence(residenceId);
  const [attachments, charges, payments, receipts] = await Promise.all([
    scoped.lotAttachment.count({ where: { lotId } }),
    scoped.chargeCall.count({ where: { lotId } }),
    scoped.payment.count({ where: { lotId } }),
    scoped.receipt.count({ where: { lotId } }),
  ]);
  return attachments + charges + payments + receipts > 0;
}

export async function archiveLot(residenceId: string, lotId: string): Promise<void> {
  await forResidence(residenceId).lot.update({
    where: { id: lotId },
    data: { archivedAt: new Date() },
  });
}

export async function deleteLot(residenceId: string, lotId: string): Promise<void> {
  await forResidence(residenceId).lot.delete({ where: { id: lotId } });
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}
