/**
 * Tarif de la vitrine (J1) — CONTENU modifiable en un seul endroit, jamais codé en dur dans
 * un composant. Provisoire, sans paliers. Montants en centimes (helper monétaire) pour rester
 * cohérent avec le reste de l'app ; l'affichage passe par `formatMoney`.
 *
 * Règle : 10 MAD / lot / mois, avec un minimum de 200 MAD / mois. Rien d'autre.
 * Le calcul est PUR et partagé par la vitrine et le calculateur d'ouverture, pour que le
 * visiteur qui a saisi 25 lots retrouve exactement le même montant dans la section Tarifs.
 */
import { toCentimes, type Centimes } from '@/lib/money';

export const PRICING = {
  /** Prix par lot et par mois. */
  perLotPerMonth: toCentimes(10),
  /** Plancher mensuel : en dessous d'un certain nombre de lots, on facture ce minimum. */
  minMonthly: toCentimes(200),
} as const;

/** Nombre de lots à partir duquel le prix au lot dépasse le plancher (200 / 10 = 20). */
export const PRICING_MIN_LOTS = Math.ceil(PRICING.minMonthly / PRICING.perLotPerMonth);

/** Abonnement mensuel pour `lots` lots (centimes). Plancher appliqué. Entrée bornée ≥ 0. */
export function monthlySubscription(lots: number): Centimes {
  const n = Number.isFinite(lots) && lots > 0 ? Math.floor(lots) : 0;
  return Math.max(PRICING.minMonthly, n * PRICING.perLotPerMonth);
}
