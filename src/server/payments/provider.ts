/**
 * Abstraction « prestataire de paiement » (G4). Le tunnel de règlement ne connaît que
 * cette interface ; l'implémentation concrète (aujourd'hui une SIMULATION) est
 * interchangeable. Un futur adaptateur réel (CMI, PayZone, Stripe…) implémentera la même
 * interface — voir README.md de ce dossier, dont la contrainte NON NÉGOCIABLE : la
 * plateforme ne détient JAMAIS les fonds (règlement direct vers le compte du syndic).
 */
import { prismaExecutor } from '@/server/db/sql';
import type { PaymentMethodValue } from '@/server/finance/payments';

/** Ce qu'on veut régler : un appel de charges d'un lot, pour un montant. */
export interface PaymentIntent {
  residenceId: string;
  lotId: string;
  chargeCallId: string;
  amountMinor: number;
}

/** Une session de règlement ouverte chez le prestataire. */
export interface CheckoutSession {
  checkoutId: string;
  provider: string;
  simulated: boolean;
}

/** Le résultat d'un règlement confirmé. `providerRef` = référence opposable du prestataire. */
export interface PaymentOutcome {
  status: 'succeeded' | 'failed';
  providerRef: string;
  method: PaymentMethodValue;
}

export interface PaymentProvider {
  readonly name: string;
  /** VRAI pour un prestataire qui SIMULE (aucune vraie transaction, aucun fonds). */
  readonly simulated: boolean;
  /** Ouvre une session de règlement (chez un vrai prestataire : une page hébergée). */
  createCheckout(intent: PaymentIntent): Promise<CheckoutSession>;
  /** Confirme le règlement (chez un vrai prestataire : après retour + vérification webhook). */
  confirm(checkoutId: string): Promise<PaymentOutcome>;
}

/**
 * Prestataire SIMULÉ. Aucun champ de carte, aucune donnée bancaire, aucune vraie
 * transaction : on simule le PARCOURS. Le paiement qui en résulte, lui, est bien réel
 * (enregistré via `writePayment`, avec son reçu numéroté) — c'est le règlement qui est
 * fictif, pas l'écriture comptable de démonstration.
 */
export class MockProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly simulated = true;

  async createCheckout(intent: PaymentIntent): Promise<CheckoutSession> {
    return { checkoutId: `mock_${intent.chargeCallId}`, provider: this.name, simulated: true };
  }

  async confirm(checkoutId: string): Promise<PaymentOutcome> {
    // Toujours « réussi » : c'est une démonstration. `providerRef` reste traçable.
    return { status: 'succeeded', providerRef: `SIMU-${checkoutId}`, method: 'EN_LIGNE' };
  }
}

/**
 * Résout le prestataire d'une résidence. Aujourd'hui : uniquement le MockProvider (le
 * seul implémenté). Le jour où un adaptateur réel existe, on le sélectionnera ici à
 * partir du `SettlementAccount` ACTIF de la résidence (le drapeau `onlinePaymentEnabled`
 * garde, lui, l'ACCÈS au tunnel — cf. l'action de paiement).
 */
export function resolvePaymentProvider(): PaymentProvider {
  return new MockProvider();
}

/**
 * Le paiement en ligne est-il activé pour cette résidence ? Drapeau par résidence,
 * désactivé par défaut : garde l'ACCÈS au tunnel (bouton « Payer » + action). `Residence`
 * n'est pas un modèle tenant scopé par `residenceId` — lecture directe bornée par l'id.
 */
export async function isOnlinePaymentEnabled(residenceId: string): Promise<boolean> {
  const rows = await prismaExecutor().query<{ enabled: boolean }>(
    `SELECT "onlinePaymentEnabled" AS enabled FROM "Residence" WHERE id = $1 LIMIT 1`,
    [residenceId],
  );
  return rows[0]?.enabled ?? false;
}
