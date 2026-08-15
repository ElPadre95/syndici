/**
 * Frais de retard (H2). Un frais est une écriture au DÉBIT d'un lot, découlant d'un appel
 * en retard. IMMUABLE : l'annulation passe par une écriture INVERSE (comme un paiement).
 *
 * Contrainte juridique (Maroc) : un syndic n'applique de pénalités que si le règlement ou
 * l'AG l'a décidé. La génération est donc CONFIGURABLE, DÉSACTIVÉE par défaut (`autoLateFee`),
 * et jamais déclenchée automatiquement — c'est une action explicite du staff. La génération
 * est IDEMPOTENTE : au plus un frais par appel (unicité sur `chargeCallId`), donc repasser
 * le job ne double jamais les frais.
 */
import { forResidence } from '@/server/db/tenant';
import { getBaseClient } from '@/server/db/client';
import type { TxRunner } from '@/server/db/sql';
import { daysLate as computeDaysLate, remainingDueMinor } from './status';
import type { ActiveContext } from '@/server/auth/context';

export interface LateFeeConfig {
  fixedMinor: number;
  percentBps: number; // points de base : 500 = 5 %
  capMinor: number | null;
}

/**
 * Montant du frais pour un reste dû : part fixe + part proportionnelle, plafonné. PURE.
 * Renvoie 0 si rien n'est dû ou si la config ne produit aucun frais.
 */
export function computeLateFeeMinor(remainingMinor: number, cfg: LateFeeConfig): number {
  if (remainingMinor <= 0) return 0;
  const proportional = Math.round((remainingMinor * cfg.percentBps) / 10000);
  let fee = cfg.fixedMinor + proportional;
  if (cfg.capMinor != null && cfg.capMinor > 0) fee = Math.min(fee, cfg.capMinor);
  return Math.max(0, fee);
}

export interface GenerateLateFeesResult {
  disabled: boolean;
  created: number;
  candidates: number;
}

/**
 * Génère les frais de retard de la résidence (staff). Gardée par `autoLateFee`. Pour chaque
 * appel en retard de ≥ `lateFeeThresholdDays` jours avec un reste dû, crée UN frais
 * (idempotent via `skipDuplicates` sur l'unicité `chargeCallId`). Trace un audit.
 */
export async function generateLateFees(
  ctx: ActiveContext,
  now: Date = new Date(),
): Promise<GenerateLateFeesResult> {
  const scoped = forResidence(ctx.residenceId);
  const residence = await getBaseClient().residence.findUnique({
    where: { id: ctx.residenceId },
    select: {
      autoLateFee: true,
      lateFeeFixedMinor: true,
      lateFeePercentBps: true,
      lateFeeCapMinor: true,
    },
  });
  if (!residence || !residence.autoLateFee) {
    return { disabled: true, created: 0, candidates: 0 };
  }
  const cfg: LateFeeConfig = {
    fixedMinor: residence.lateFeeFixedMinor,
    percentBps: residence.lateFeePercentBps,
    capMinor: residence.lateFeeCapMinor,
  };

  const rule = await scoped.reminderRule.findFirst({
    where: { active: true },
    orderBy: { version: 'desc' },
    select: { id: true, lateFeeThresholdDays: true },
  });
  const threshold = rule?.lateFeeThresholdDays ?? 10;

  const calls = await scoped.chargeCall.findMany({
    where: { voidedAt: null },
    select: { id: true, lotId: true, dueDate: true, amountMinor: true },
  });
  if (calls.length === 0) return { disabled: false, created: 0, candidates: 0 };

  const allocs = await scoped.paymentAllocation.findMany({
    where: { chargeCallId: { in: calls.map((c) => c.id) } },
    select: { chargeCallId: true, amountMinor: true },
  });
  const allocByCall = new Map<string, number>();
  for (const a of allocs)
    allocByCall.set(a.chargeCallId, (allocByCall.get(a.chargeCallId) ?? 0) + a.amountMinor);

  const candidates = calls.flatMap((c) => {
    if (computeDaysLate(c.dueDate, now) < threshold) return [];
    const remaining = remainingDueMinor(c.amountMinor, Math.max(0, allocByCall.get(c.id) ?? 0));
    const fee = computeLateFeeMinor(remaining, cfg);
    if (fee <= 0) return [];
    return [
      {
        residenceId: ctx.residenceId,
        lotId: c.lotId,
        chargeCallId: c.id,
        amountMinor: fee,
        reason: 'Frais de retard automatique',
        reminderRuleId: rule?.id ?? null,
      },
    ];
  });

  // Idempotence : `skipDuplicates` ignore les appels déjà porteurs d'un frais (unicité
  // sur chargeCallId). Repasser la génération ne crée donc jamais de doublon.
  const res =
    candidates.length > 0
      ? await scoped.lateFee.createMany({ data: candidates, skipDuplicates: true })
      : { count: 0 };

  if (res.count > 0) {
    await scoped.auditLog.create({
      data: {
        residenceId: ctx.residenceId,
        actorPersonId: ctx.personId,
        action: 'latefee.generate',
        entityType: 'Residence',
        entityId: ctx.residenceId,
        after: { created: res.count, threshold, cfg },
      },
    });
  }
  return { disabled: false, created: res.count, candidates: candidates.length };
}

export type ReverseLateFeeResult =
  | { ok: true; reversalId: string }
  | { ok: false; reason: 'not_found' | 'already_reversed' | 'is_reversal' };

const INSERT_LATEFEE_REVERSAL = `
  INSERT INTO "LateFee"
    (id,"residenceId","lotId","chargeCallId","amountMinor",reason,"reversesLateFeeId","appliedAt","createdAt")
  VALUES (gen_random_uuid(),$1,$2,NULL,$3,$4,$5,now(),now())
  RETURNING id`;
const INSERT_LATEFEE_AUDIT = `
  INSERT INTO "AuditLog" (id,"residenceId","actorPersonId",action,"entityType","entityId",after,at)
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6::jsonb,now())`;

/**
 * Annule un frais de retard par ÉCRITURE INVERSE (frais négatif liant l'original), comme
 * `reversePayment`. Refuse d'annuler un frais déjà annulé ou qui est lui-même une annulation.
 * L'inverse porte `chargeCallId` NULL : l'unicité de l'original tient, l'appel ne peut pas
 * être re-facturé par la génération.
 */
export async function reverseLateFee(
  runner: TxRunner,
  params: { residenceId: string; lateFeeId: string; reason: string; actorPersonId: string },
): Promise<ReverseLateFeeResult> {
  return runner.transaction(async (tx) => {
    const orig = (
      await tx.query<{ id: string; lotId: string; amountMinor: number; reversesLateFeeId: string | null }>(
        `SELECT id,"lotId","amountMinor","reversesLateFeeId"
           FROM "LateFee" WHERE id = $1 AND "residenceId" = $2 FOR UPDATE`,
        [params.lateFeeId, params.residenceId],
      )
    )[0];
    if (!orig) return { ok: false as const, reason: 'not_found' as const };
    if (orig.reversesLateFeeId) return { ok: false as const, reason: 'is_reversal' as const };
    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM "LateFee" WHERE "reversesLateFeeId" = $1 LIMIT 1`,
      [params.lateFeeId],
    );
    if (existing[0]) return { ok: false as const, reason: 'already_reversed' as const };

    const reversalId = (
      await tx.query<{ id: string }>(INSERT_LATEFEE_REVERSAL, [
        params.residenceId,
        orig.lotId,
        -orig.amountMinor,
        params.reason,
        orig.id,
      ])
    )[0]!.id;
    await tx.query(INSERT_LATEFEE_AUDIT, [
      params.residenceId,
      params.actorPersonId,
      'latefee.reverse',
      'LateFee',
      reversalId,
      JSON.stringify({ reverses: orig.id, amountMinor: -orig.amountMinor, reason: params.reason }),
    ]);
    return { ok: true as const, reversalId };
  });
}

export interface LotLateFeeRow {
  id: string;
  amountMinor: number;
  appliedAt: string;
  reason: string | null;
  reversed: boolean;
  isReversal: boolean;
}

/** Frais de retard d'un lot (pour la vue staff : annuler un frais). */
export async function listLotLateFees(ctx: ActiveContext, lotId: string): Promise<LotLateFeeRow[]> {
  const rows = await forResidence(ctx.residenceId).lateFee.findMany({
    where: { lotId },
    orderBy: { appliedAt: 'desc' },
    select: { id: true, amountMinor: true, appliedAt: true, reason: true, reversesLateFeeId: true },
  });
  const reversedIds = new Set(
    rows.filter((r) => r.reversesLateFeeId).map((r) => r.reversesLateFeeId as string),
  );
  return rows.map((r) => ({
    id: r.id,
    amountMinor: r.amountMinor,
    appliedAt: r.appliedAt.toISOString(),
    reason: r.reason,
    reversed: reversedIds.has(r.id),
    isReversal: r.reversesLateFeeId != null,
  }));
}
