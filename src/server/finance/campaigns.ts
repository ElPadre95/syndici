/**
 * Campagnes d'appels de charges (B1). Une « campagne » = l'ensemble des appels d'une
 * résidence pour une période (année, mois) ; pas de table dédiée, on agrège `ChargeCall`.
 *
 * Règles :
 *   - Un appel par lot non archivé. Montant = charge configurée du lot, sinon défaut
 *     de la résidence selon le type. Échéance = jour d'échéance de la résidence.
 *   - Le REDEVABLE est DÉRIVÉ du rattachement actif porteur des charges (propriétaire,
 *     ou locataire si délégation) — jamais un champ figé sur l'appel.
 *   - IDEMPOTENCE : un lot déjà appelé pour la période n'est pas réécrit (index unique
 *     `(lotId, periodYear, periodMonth)` + `ON CONFLICT DO NOTHING`). Un lot vacant est
 *     appelé comme les autres (le propriétaire reste redevable).
 *   - Toute génération est tracée dans le journal d'audit.
 *
 * Découpage testable : `computeCampaignPlan` / `aggregateCampaigns` sont PURS ;
 * `writeCampaign` s'appuie sur `TxRunner` (SQL brut typé, cf. conventions §5 bis) donc
 * tourne en prod (Prisma) ET en test (PGlite / Postgres réel).
 */
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor, prismaTxRunner, type TxRunner } from '@/server/db/sql';
import { listResidents } from '@/server/auth/person-access';
import { getResidenceChargeConfig } from '@/server/residences/data';
import type { ActiveContext } from '@/server/auth/context';

export interface Period {
  year: number;
  month: number; // 1..12
}

/** Montant d'appel d'un lot : sa charge configurée si > 0, sinon le défaut résidence par type. */
export function callAmountForLot(
  lot: { type: 'APPARTEMENT' | 'VILLA'; monthlyChargeMinor: number },
  defaults: { appt: number; villa: number },
): number {
  if (lot.monthlyChargeMinor > 0) return lot.monthlyChargeMinor;
  return lot.type === 'VILLA' ? defaults.villa : defaults.appt;
}

/** Échéance d'une période : le jour d'échéance de la résidence, borné au dernier jour du mois. */
export function dueDateForPeriod(period: Period, dueDayOfMonth: number): Date {
  const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  const day = Math.min(Math.max(1, dueDayOfMonth), lastDay);
  return new Date(Date.UTC(period.year, period.month - 1, day));
}

export interface CampaignLotLine {
  lotId: string;
  reference: string;
  type: 'APPARTEMENT' | 'VILLA';
  amountMinor: number;
  payerName: string | null; // redevable dérivé (staff) ; null si non identifiable
  alreadyCalled: boolean; // déjà appelé pour cette période (ignoré à la génération)
}

export interface CampaignPreview {
  period: Period;
  dueDate: string; // ISO
  lines: CampaignLotLine[];
  toCallCount: number;
  alreadyCalledCount: number;
  totalToCallMinor: number;
}

export interface CampaignGenResult {
  created: number;
  skipped: number;
  totalCreatedMinor: number;
}

export interface CampaignSummary {
  year: number;
  month: number;
  dueDate: string; // ISO
  lotsCalled: number;
  totalCalledMinor: number;
  totalCollectedMinor: number;
  remainingMinor: number;
  collectionRate: number; // 0..1
}

// ── Cœur PUR ────────────────────────────────────────────────────────────────

export interface PlanInput {
  period: Period;
  dueDate: Date;
  lots: Array<{
    id: string;
    reference: string;
    type: 'APPARTEMENT' | 'VILLA';
    monthlyChargeMinor: number;
  }>;
  existingLotIds: ReadonlySet<string>;
  payerNameByLot: ReadonlyMap<string, string | null>;
  defaults: { appt: number; villa: number };
}

/** Construit l'aperçu d'une campagne à partir de données déjà chargées. PUR. */
export function computeCampaignPlan(input: PlanInput): CampaignPreview {
  const lines: CampaignLotLine[] = input.lots.map((lot) => ({
    lotId: lot.id,
    reference: lot.reference,
    type: lot.type,
    amountMinor: callAmountForLot(lot, input.defaults),
    payerName: input.payerNameByLot.get(lot.id) ?? null,
    alreadyCalled: input.existingLotIds.has(lot.id),
  }));
  const toCall = lines.filter((l) => !l.alreadyCalled);
  return {
    period: input.period,
    dueDate: input.dueDate.toISOString(),
    lines,
    toCallCount: toCall.length,
    alreadyCalledCount: lines.length - toCall.length,
    totalToCallMinor: toCall.reduce((s, l) => s + l.amountMinor, 0),
  };
}

export interface RawCall {
  id: string;
  periodYear: number;
  periodMonth: number;
  amountMinor: number;
  dueDate: Date;
}

/** Agrège les appels + allocations en une ligne de suivi par période. PUR. */
export function aggregateCampaigns(
  calls: RawCall[],
  allocations: Array<{ chargeCallId: string; amountMinor: number }>,
): CampaignSummary[] {
  const allocByCall = new Map<string, number>();
  for (const a of allocations)
    allocByCall.set(a.chargeCallId, (allocByCall.get(a.chargeCallId) ?? 0) + a.amountMinor);

  interface Agg {
    year: number;
    month: number;
    dueDate: Date;
    called: number;
    collected: number;
    lots: number;
  }
  const byPeriod = new Map<string, Agg>();
  for (const c of calls) {
    const key = `${c.periodYear}-${c.periodMonth}`;
    let agg = byPeriod.get(key);
    if (!agg) {
      agg = {
        year: c.periodYear,
        month: c.periodMonth,
        dueDate: c.dueDate,
        called: 0,
        collected: 0,
        lots: 0,
      };
      byPeriod.set(key, agg);
    }
    agg.called += c.amountMinor;
    agg.lots += 1;
    agg.collected += Math.min(allocByCall.get(c.id) ?? 0, c.amountMinor);
  }

  return [...byPeriod.values()]
    .map((a) => ({
      year: a.year,
      month: a.month,
      dueDate: a.dueDate.toISOString(),
      lotsCalled: a.lots,
      totalCalledMinor: a.called,
      totalCollectedMinor: a.collected,
      remainingMinor: Math.max(0, a.called - a.collected),
      collectionRate: a.called > 0 ? a.collected / a.called : 0,
    }))
    .sort((x, y) => y.year - x.year || y.month - x.month);
}

// ── Écriture (executor-based, testable PGlite + Postgres réel) ───────────────

const INSERT_CALL = `
  INSERT INTO "ChargeCall"
    (id,"residenceId","lotId","periodYear","periodMonth","dueDate","amountMinor","createdAt")
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5::date,$6,now())
  ON CONFLICT ("lotId","periodYear","periodMonth") DO NOTHING
  RETURNING id`;

const INSERT_AUDIT = `
  INSERT INTO "AuditLog"
    (id,"residenceId","actorPersonId",action,"entityType","entityId",after,at)
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6::jsonb,now())`;

/**
 * Écrit les appels d'une campagne, en IGNORANT les doublons (idempotence par l'index
 * unique). Trace une entrée d'audit. Renvoie le nombre RÉELLEMENT créé.
 */
export async function writeCampaign(
  runner: TxRunner,
  residenceId: string,
  actorPersonId: string,
  period: Period,
  dueDate: Date,
  toCall: Array<{ lotId: string; amountMinor: number }>,
  totalMinor: number,
): Promise<number> {
  const day = dueDate.toISOString().slice(0, 10);
  return runner.transaction(async (tx) => {
    let created = 0;
    for (const l of toCall) {
      const rows = await tx.query<{ id: string }>(INSERT_CALL, [
        residenceId,
        l.lotId,
        period.year,
        period.month,
        day,
        l.amountMinor,
      ]);
      if (rows[0]) created++;
    }
    await tx.query(INSERT_AUDIT, [
      residenceId,
      actorPersonId,
      'chargeCall.campaign.generate',
      'ChargeCall',
      `${period.year}-${String(period.month).padStart(2, '0')}`,
      JSON.stringify({ period, created, totalMinor }),
    ]);
    return created;
  });
}

// ── Points d'entrée applicatifs (Prisma) ─────────────────────────────────────

/** Aperçu d'une campagne (rien n'est écrit). `null` si la résidence est introuvable. */
export async function previewCampaign(
  ctx: ActiveContext,
  period: Period,
): Promise<CampaignPreview | null> {
  const config = await getResidenceChargeConfig(ctx.residenceId);
  if (!config) return null;
  const dueDate = dueDateForPeriod(period, config.dueDayOfMonth);
  const scoped = forResidence(ctx.residenceId);

  const [lots, existing, payers] = await Promise.all([
    scoped.lot.findMany({
      where: { archivedAt: null },
      orderBy: { reference: 'asc' },
      select: { id: true, reference: true, type: true, monthlyChargeMinor: true },
    }),
    scoped.chargeCall.findMany({
      where: { periodYear: period.year, periodMonth: period.month },
      select: { lotId: true },
    }),
    scoped.lotAttachment.findMany({
      where: { endDate: null, isChargePayer: true },
      select: { lotId: true, personId: true },
    }),
  ]);

  const payerByLot = new Map(payers.map((p) => [p.lotId, p.personId]));
  const nameById = new Map<string, string>();
  for (const p of await listResidents(prismaExecutor(), ctx)) {
    nameById.set(p.id, `${p.firstName} ${p.lastName}`.trim());
  }
  const payerNameByLot = new Map<string, string | null>();
  for (const lot of lots) {
    const pid = payerByLot.get(lot.id);
    payerNameByLot.set(lot.id, pid ? (nameById.get(pid) ?? null) : null);
  }

  return computeCampaignPlan({
    period,
    dueDate,
    lots: lots.map((l) => ({ ...l, type: l.type as 'APPARTEMENT' | 'VILLA' })),
    existingLotIds: new Set(existing.map((e) => e.lotId)),
    payerNameByLot,
    defaults: { appt: config.defaultChargeApptMinor, villa: config.defaultChargeVillaMinor },
  });
}

/** Génère (ou complète) la campagne d'une période, de façon idempotente. */
export async function generateCampaign(
  ctx: ActiveContext,
  period: Period,
): Promise<CampaignGenResult> {
  const preview = await previewCampaign(ctx, period);
  if (!preview) return { created: 0, skipped: 0, totalCreatedMinor: 0 };
  const toCall = preview.lines
    .filter((l) => !l.alreadyCalled)
    .map((l) => ({ lotId: l.lotId, amountMinor: l.amountMinor }));
  if (toCall.length === 0) {
    return { created: 0, skipped: preview.alreadyCalledCount, totalCreatedMinor: 0 };
  }
  const created = await writeCampaign(
    prismaTxRunner(),
    ctx.residenceId,
    ctx.personId,
    period,
    new Date(preview.dueDate),
    toCall,
    preview.totalToCallMinor,
  );
  return {
    created,
    skipped: preview.alreadyCalledCount,
    totalCreatedMinor: preview.totalToCallMinor,
  };
}

/** Suivi : une ligne par campagne (période). */
export async function listCampaigns(ctx: ActiveContext): Promise<CampaignSummary[]> {
  const scoped = forResidence(ctx.residenceId);
  const [calls, allocs] = await Promise.all([
    scoped.chargeCall.findMany({
      where: { voidedAt: null },
      select: { id: true, periodYear: true, periodMonth: true, amountMinor: true, dueDate: true },
    }),
    scoped.paymentAllocation.findMany({ select: { chargeCallId: true, amountMinor: true } }),
  ]);
  return aggregateCampaigns(calls, allocs);
}
