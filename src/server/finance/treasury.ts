/**
 * Trésorerie de la résidence (C2) : encaissé − dépensé sur une période. Les deux sommes
 * sont NETTES (les annulations, écritures négatives, se déduisent naturellement). Les
 * dépenses INTERNE sont incluses : la trésorerie est un fait comptable, pas une vue de
 * transparence — elle ne dépend pas de la visibilité.
 */
import { forResidence } from '@/server/db/tenant';
import type { ActiveContext } from '@/server/auth/context';

export interface Treasury {
  collectedMinor: number; // encaissé net (paiements)
  spentMinor: number; // dépensé net (dépenses)
  netMinor: number; // collected − spent
}

function dateRange(from?: Date, to?: Date): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

/** Encaissé, dépensé et solde net sur la période (ou tout l'historique si non bornée). */
export async function getTreasury(
  ctx: ActiveContext,
  opts: { from?: Date; to?: Date } = {},
): Promise<Treasury> {
  const scoped = forResidence(ctx.residenceId);
  const received = dateRange(opts.from, opts.to);
  const spent = dateRange(opts.from, opts.to);
  const [pay, exp] = await Promise.all([
    scoped.payment.aggregate({
      _sum: { amountMinor: true },
      where: received ? { receivedAt: received } : {},
    }),
    scoped.expense.aggregate({
      _sum: { amountMinor: true },
      // Le fonds travaux (I2) ne se mélange JAMAIS à la trésorerie courante.
      where: { onWorksFund: false, ...(spent ? { spentOn: spent } : {}) },
    }),
  ]);
  const collectedMinor = pay._sum.amountMinor ?? 0;
  const spentMinor = exp._sum.amountMinor ?? 0;
  return { collectedMinor, spentMinor, netMinor: collectedMinor - spentMinor };
}
