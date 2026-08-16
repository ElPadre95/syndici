/**
 * Fonds de provisions travaux (I2). DISTINCT de la trésorerie courante : son solde =
 * contributions (appels dédiés) − dépenses imputées (`Expense.onWorksFund`). Ni les
 * contributions ni ces dépenses n'entrent dans `getTreasury`. Contributions IMMUABLES :
 * annulation par écriture inverse, comme les paiements et les frais de retard.
 */
import { forResidence } from '@/server/db/tenant';
import { signedFilePath } from '@/server/storage/sign';
import type { TxRunner } from '@/server/db/sql';
import type { ActiveContext } from '@/server/auth/context';

export interface FundContributionRow {
  id: string;
  amountMinor: number;
  label: string;
  occurredOn: string;
  reversed: boolean;
  isReversal: boolean;
}
export interface FundExpenseRow {
  id: string;
  description: string;
  amountMinor: number;
  spentOn: string;
  categoryLabel: string | null;
  justificatifHref: string | null;
}
export interface WorksFundView {
  contributedMinor: number; // net des contributions (annulations comprises)
  spentMinor: number; // total imputé sur le fonds
  balanceMinor: number; // contributions − dépenses
  contributions: FundContributionRow[];
  expenses: FundExpenseRow[];
}

/** État du fonds travaux. `includeInternal` : le staff voit les dépenses INTERNE du fonds. */
export async function getWorksFund(
  ctx: ActiveContext,
  includeInternal: boolean,
): Promise<WorksFundView> {
  const scoped = forResidence(ctx.residenceId);
  const [contribs, fundExpenses] = await Promise.all([
    scoped.worksFundContribution.findMany({
      orderBy: { occurredOn: 'desc' },
      select: { id: true, amountMinor: true, label: true, occurredOn: true, reversesContributionId: true },
    }),
    scoped.expense.findMany({
      where: {
        onWorksFund: true,
        reversesExpenseId: null,
        voidedAt: null,
        ...(includeInternal ? {} : { visibility: 'PARTAGE' }),
      },
      orderBy: { spentOn: 'desc' },
      select: {
        id: true,
        description: true,
        supplierName: true,
        amountMinor: true,
        spentOn: true,
        justificatifId: true,
        category: { select: { label: true } },
      },
    }),
  ]);

  const contributedMinor = contribs.reduce((s, c) => s + c.amountMinor, 0);
  const spentMinor = fundExpenses.reduce((s, e) => s + e.amountMinor, 0);
  const reversedSet = new Set(
    contribs.filter((c) => c.reversesContributionId).map((c) => c.reversesContributionId as string),
  );

  return {
    contributedMinor,
    spentMinor,
    balanceMinor: contributedMinor - spentMinor,
    contributions: contribs.map((c) => ({
      id: c.id,
      amountMinor: c.amountMinor,
      label: c.label,
      occurredOn: c.occurredOn.toISOString(),
      reversed: reversedSet.has(c.id),
      isReversal: c.reversesContributionId != null,
    })),
    expenses: fundExpenses.map((e) => ({
      id: e.id,
      description: e.supplierName ?? e.description,
      amountMinor: e.amountMinor,
      spentOn: e.spentOn.toISOString(),
      categoryLabel: e.category?.label ?? null,
      justificatifHref: e.justificatifId ? signedFilePath(e.justificatifId, 3600) : null,
    })),
  };
}

export type ReverseContributionResult =
  | { ok: true; reversalId: string }
  | { ok: false; reason: 'not_found' | 'already_reversed' | 'is_reversal' };

const INSERT_CONTRIB_REVERSAL = `
  INSERT INTO "WorksFundContribution"
    (id,"residenceId","amountMinor",label,"occurredOn","reversesContributionId","createdAt")
  VALUES (gen_random_uuid(),$1,$2,$3,CURRENT_DATE,$4,now())
  RETURNING id`;
const INSERT_FUND_AUDIT = `
  INSERT INTO "AuditLog" (id,"residenceId","actorPersonId",action,"entityType","entityId",after,at)
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6::jsonb,now())`;

/** Annule une contribution par écriture INVERSE (mirroir de `reversePayment`/`reverseLateFee`). */
export async function reverseWorksFundContribution(
  runner: TxRunner,
  params: { residenceId: string; contributionId: string; actorPersonId: string },
): Promise<ReverseContributionResult> {
  return runner.transaction(async (tx) => {
    const orig = (
      await tx.query<{ id: string; amountMinor: number; label: string; reversesContributionId: string | null }>(
        `SELECT id,"amountMinor",label,"reversesContributionId"
           FROM "WorksFundContribution" WHERE id = $1 AND "residenceId" = $2 FOR UPDATE`,
        [params.contributionId, params.residenceId],
      )
    )[0];
    if (!orig) return { ok: false as const, reason: 'not_found' as const };
    if (orig.reversesContributionId) return { ok: false as const, reason: 'is_reversal' as const };
    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM "WorksFundContribution" WHERE "reversesContributionId" = $1 LIMIT 1`,
      [params.contributionId],
    );
    if (existing[0]) return { ok: false as const, reason: 'already_reversed' as const };

    const reversalId = (
      await tx.query<{ id: string }>(INSERT_CONTRIB_REVERSAL, [
        params.residenceId,
        -orig.amountMinor,
        `Annulation — ${orig.label}`,
        orig.id,
      ])
    )[0]!.id;
    await tx.query(INSERT_FUND_AUDIT, [
      params.residenceId,
      params.actorPersonId,
      'worksfund.reverse',
      'WorksFundContribution',
      reversalId,
      JSON.stringify({ reverses: orig.id, amountMinor: -orig.amountMinor }),
    ]);
    return { ok: true as const, reversalId };
  });
}
