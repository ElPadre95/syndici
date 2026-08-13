/**
 * Contrats fournisseurs (C3). Nom, fournisseur, montant, échéance, fréquence. Le
 * compte à rebours et l'alerte sont DÉRIVÉS de l'échéance vs la date RÉELLE du serveur
 * (SPEC §7.2, le M1 « date figée » du prototype est corrigé) — jamais stockés. Écriture
 * executor-based (testable PGlite ET Postgres réel), tracée au journal d'audit.
 *
 * Seuils d'alerte (§7.2) :
 *   jours < 0   → « Expiré »   (rouge)
 *   jours ≤ 30  → « n jours »  (orange)
 *   sinon       → « n jours »  (vert)
 */
import { forResidence } from '@/server/db/tenant';
import type { TxRunner } from '@/server/db/sql';
import type { ActiveContext } from '@/server/auth/context';

export type ContractTier = 'expired' | 'soon' | 'ok';
export type ContractFrequency = 'MENSUEL' | 'TRIMESTRIEL' | 'SEMESTRIEL' | 'ANNUEL';
export const CONTRACT_FREQUENCIES: readonly ContractFrequency[] = [
  'MENSUEL',
  'TRIMESTRIEL',
  'SEMESTRIEL',
  'ANNUEL',
];

export interface Countdown {
  daysUntil: number; // au jour près (négatif = échéance passée)
  tier: ContractTier;
}

const DAY_MS = 86_400_000;
const midnightUTC = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Jours avant échéance (au jour près) + palier d'alerte. Fonction PURE (SPEC §7.2). */
export function contractCountdown(endDate: Date, now: Date): Countdown {
  const daysUntil = Math.round((midnightUTC(endDate) - midnightUTC(now)) / DAY_MS);
  const tier: ContractTier = daysUntil < 0 ? 'expired' : daysUntil <= 30 ? 'soon' : 'ok';
  return { daysUntil, tier };
}

// ── Écriture ─────────────────────────────────────────────────────────────────

const INSERT_CONTRACT = `
  INSERT INTO "SupplierContract"
    (id,"residenceId",name,"supplierName","amountMinor","startDate","endDate",frequency,"createdAt")
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5::date,$6::date,$7::"ContractFrequency",now())
  RETURNING id`;

const INSERT_AUDIT = `
  INSERT INTO "AuditLog" (id,"residenceId","actorPersonId",action,"entityType","entityId",after,at)
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6::jsonb,now())`;

export interface RecordContractInput {
  residenceId: string;
  name: string;
  supplierName: string | null;
  amountMinor: number | null;
  startDate: Date | null;
  endDate: Date;
  frequency: ContractFrequency;
  actorPersonId: string;
}

/** Crée un contrat + une trace d'audit, dans une transaction. */
export async function writeContract(runner: TxRunner, input: RecordContractInput): Promise<string> {
  return runner.transaction(async (tx) => {
    const id = (
      await tx.query<{ id: string }>(INSERT_CONTRACT, [
        input.residenceId,
        input.name,
        input.supplierName,
        input.amountMinor,
        input.startDate ? input.startDate.toISOString().slice(0, 10) : null,
        input.endDate.toISOString().slice(0, 10),
        input.frequency,
      ])
    )[0]!.id;
    await tx.query(INSERT_AUDIT, [
      input.residenceId,
      input.actorPersonId,
      'contract.record',
      'SupplierContract',
      id,
      JSON.stringify({ name: input.name, amountMinor: input.amountMinor }),
    ]);
    return id;
  });
}

export type ArchiveContractResult = { ok: true } | { ok: false; reason: 'not_found' };

/** Archive un contrat (soft delete : `archivedAt`), tracé au journal d'audit. */
export async function archiveContract(
  runner: TxRunner,
  params: { residenceId: string; contractId: string; actorPersonId: string; now?: Date },
): Promise<ArchiveContractResult> {
  const now = params.now ?? new Date();
  return runner.transaction(async (tx) => {
    const rows = await tx.query<{ id: string }>(
      `UPDATE "SupplierContract" SET "archivedAt" = $3::timestamp
        WHERE id = $1 AND "residenceId" = $2 AND "archivedAt" IS NULL RETURNING id`,
      [params.contractId, params.residenceId, now.toISOString()],
    );
    if (!rows[0]) return { ok: false as const, reason: 'not_found' as const };
    await tx.query(INSERT_AUDIT, [
      params.residenceId,
      params.actorPersonId,
      'contract.archive',
      'SupplierContract',
      params.contractId,
      JSON.stringify({ archived: true }),
    ]);
    return { ok: true as const };
  });
}

// ── Lecture ──────────────────────────────────────────────────────────────────

export interface ContractView {
  id: string;
  name: string;
  supplierName: string | null;
  amountMinor: number | null;
  endDate: string;
  frequency: ContractFrequency;
  daysUntil: number;
  tier: ContractTier;
}

/** Contrats actifs de la résidence, triés par échéance la plus proche d'abord (§7.2). */
export async function listContracts(
  ctx: ActiveContext,
  now: Date = new Date(),
): Promise<ContractView[]> {
  const scoped = forResidence(ctx.residenceId);
  const contracts = await scoped.supplierContract.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      supplierName: true,
      amountMinor: true,
      endDate: true,
      frequency: true,
    },
  });
  return contracts
    .map((c) => {
      const { daysUntil, tier } = contractCountdown(c.endDate, now);
      return {
        id: c.id,
        name: c.name,
        supplierName: c.supplierName,
        amountMinor: c.amountMinor,
        endDate: c.endDate.toISOString(),
        frequency: c.frequency as ContractFrequency,
        daysUntil,
        tier,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil); // échéance la plus proche (ou dépassée) en tête
}
