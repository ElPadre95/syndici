'use server';

/**
 * Paiement en ligne SIMULÉ (G4). Le tunnel aboutit à un paiement RÉELLEMENT enregistré
 * (via `writePayment` — jamais un contournement), avec son reçu numéroté. Réservé au
 * PROPRIÉTAIRE du lot concerné (jamais le staff), et uniquement si la résidence l'autorise.
 *
 * Gardes cumulées, dans l'ordre : rôle PROPRIETAIRE + `payment.pay.own` → résidence
 * activée → détention du lot de l'appel → reste dû > 0. Aucune donnée de carte n'est reçue
 * ni attendue (le formulaire n'en contient pas) : on ne collecte rien.
 */
import { revalidatePath } from 'next/cache';
import { forResidence } from '@/server/db/tenant';
import { prismaTxRunner } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { writePayment } from '@/server/finance/payments';
import { getOwnerLotCharges } from '@/server/finance/owner';
import { resolvePaymentProvider, isOnlinePaymentEnabled } from './provider';

export type SimulatePaymentResult =
  | { ok: true; receiptId: string | null; amountMinor: number }
  | { ok: false; error: 'forbidden' | 'disabled' | 'not_found' | 'nothing_due' | 'failed' };

export async function simulatePaymentAction(formData: FormData): Promise<SimulatePaymentResult> {
  const ctx = await getSessionContext();
  // Rôle : propriétaire uniquement (jamais le staff), avec le droit dédié.
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'payment.pay.own')) {
    return { ok: false, error: 'forbidden' };
  }
  const residenceId = ctx.activeId;
  const actx = { personId: ctx.personId, residenceId, role: ctx.role };

  // Résidence : le tunnel doit être activé (désactivé par défaut).
  if (!(await isOnlinePaymentEnabled(residenceId))) return { ok: false, error: 'disabled' };

  const chargeCallId = String(formData.get('chargeCallId') ?? '');
  if (!chargeCallId) return { ok: false, error: 'not_found' };

  // Appel de charges → son lot (borné à la résidence active).
  const scoped = forResidence(residenceId);
  const call = await scoped.chargeCall.findUnique({
    where: { id: chargeCallId },
    select: { lotId: true, voidedAt: true },
  });
  if (!call || call.voidedAt) return { ok: false, error: 'not_found' };

  // Détention du lot + reste dû : `getOwnerLotCharges` re-vérifie la propriété (ownsLot) et
  // renvoie [] si le lot n'est pas au propriétaire → défense en profondeur.
  const charges = await getOwnerLotCharges(actx, call.lotId);
  const charge = charges.find((c) => c.id === chargeCallId);
  if (!charge) return { ok: false, error: 'forbidden' };
  if (charge.remainingMinor <= 0) return { ok: false, error: 'nothing_due' };

  // Tunnel simulé : ouvrir puis confirmer chez le prestataire (aucune vraie transaction).
  const provider = resolvePaymentProvider();
  const checkout = await provider.createCheckout({
    residenceId,
    lotId: call.lotId,
    chargeCallId,
    amountMinor: charge.remainingMinor,
  });
  const outcome = await provider.confirm(checkout.checkoutId);
  if (outcome.status !== 'succeeded') return { ok: false, error: 'failed' };

  // Paiement RÉEL : écriture immuable + allocation + reçu numéroté, dans une transaction.
  const paymentId = await writePayment(prismaTxRunner(), {
    residenceId,
    lotId: call.lotId,
    chargeCallId,
    payerPersonId: ctx.personId, // le propriétaire règle lui-même
    recordedByPersonId: ctx.personId,
    method: outcome.method, // EN_LIGNE
    amountMinor: charge.remainingMinor,
    receivedAt: new Date(),
    reference: outcome.providerRef,
    note: 'Paiement en ligne (simulation)',
    actorPersonId: ctx.personId,
  });

  const receipt = await scoped.receipt.findFirst({
    where: { paymentId },
    select: { id: true },
  });

  revalidatePath('/', 'layout');
  return { ok: true, receiptId: receipt?.id ?? null, amountMinor: charge.remainingMinor };
}
