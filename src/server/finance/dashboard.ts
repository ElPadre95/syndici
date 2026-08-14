/**
 * Résumé de tableau de bord pour le staff (correctif : l'accueil A1 ne montrait
 * jamais rien d'utile pour une résidence active). Sobre — quelques chiffres justes,
 * dérivés de ce que B1 a déjà bâti (`listCampaigns`) + un compte de lots + l'encaissé
 * du mois. Le vrai tableau de bord viendra plus tard.
 */
import { forResidence } from '@/server/db/tenant';
import { listCampaigns } from './campaigns';
import { getTreasury, type Treasury } from './treasury';
import { listDunning } from './dunning';
import type { ActiveContext } from '@/server/auth/context';

export interface StaffDashboard {
  lots: number;
  /** Campagne EN COURS : celle du mois calendaire, sinon la plus récente. Null si aucune. */
  current: {
    year: number;
    month: number;
    collectionRate: number; // 0..1
    remainingMinor: number;
    collectedMinor: number;
  } | null;
  totalRemainingMinor: number; // impayés cumulés (toutes campagnes)
  collectedThisMonthMinor: number; // net encaissé ce mois calendaire (annulations comprises)
  treasury: Treasury; // trésorerie réelle : encaissé − dépensé (tout l'historique)
  dunningCount: number; // relances nécessaires (moteur §7.1, anti-harcèlement appliqué)
}

export async function getStaffDashboard(
  ctx: ActiveContext,
  now: Date = new Date(),
): Promise<StaffDashboard> {
  const scoped = forResidence(ctx.residenceId);
  const campaigns = await listCampaigns(ctx);
  // La campagne « en cours » = celle du mois courant si elle existe, sinon la plus
  // récente (listCampaigns trie par période décroissante).
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const current = campaigns.find((c) => c.year === y && c.month === m) ?? campaigns[0] ?? null;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [lots, agg, treasury, dunning] = await Promise.all([
    scoped.lot.count({ where: { archivedAt: null } }),
    scoped.payment.aggregate({
      _sum: { amountMinor: true },
      where: { receivedAt: { gte: monthStart, lt: nextMonth } },
    }),
    getTreasury(ctx), // tout l'historique : encaissé − dépensé
    listDunning(ctx, now), // relances nécessaires (§7.1)
  ]);

  return {
    lots,
    current: current
      ? {
          year: current.year,
          month: current.month,
          collectionRate: current.collectionRate,
          remainingMinor: current.remainingMinor,
          collectedMinor: current.totalCollectedMinor,
        }
      : null,
    totalRemainingMinor: campaigns.reduce((s, c) => s + c.remainingMinor, 0),
    collectedThisMonthMinor: agg._sum.amountMinor ?? 0,
    treasury,
    dunningCount: dunning.items.length,
  };
}
