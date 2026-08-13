'use server';

/**
 * Actions d'encaissement (B2). Enregistrer un paiement sur un appel, ou l'annuler par
 * écriture inverse. Toute action passe par le point d'application des autorisations :
 * `can(role, 'payment.record')` — staff uniquement. Aucun paiement par carte.
 */
import { revalidatePath } from 'next/cache';
import { forResidence } from '@/server/db/tenant';
import { prismaTxRunner } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { can, type AppRole } from '@/server/auth/permissions';
import { parseMoneyToCentimes } from '@/server/import/normalize';
import { writePayment, reversePayment, MANUAL_METHODS, type ManualMethod } from './payments';
import type { PaymentActionResult } from './payment-action-types';

type Recorder =
  | { ok: true; ctx: { personId: string; residenceId: string; role: AppRole } }
  | { ok: false; error: 'forbidden' | 'no_active_residence' };

async function requirePaymentRecorder(): Promise<Recorder> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'payment.record')) return { ok: false, error: 'forbidden' };
  return { ok: true, ctx: { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role } };
}

export async function recordPaymentAction(formData: FormData): Promise<PaymentActionResult> {
  const rec = await requirePaymentRecorder();
  if (!rec.ok) return { ok: false, error: rec.error };

  const chargeCallId = String(formData.get('chargeCallId') ?? '');
  const amountMinor = parseMoneyToCentimes(String(formData.get('amount') ?? ''));
  const method = String(formData.get('method') ?? '') as ManualMethod;
  if (amountMinor === null || amountMinor <= 0) return { ok: false, error: 'invalid_amount' };
  if (!MANUAL_METHODS.includes(method)) return { ok: false, error: 'invalid_method' };

  const receivedStr = String(formData.get('receivedAt') ?? '');
  const receivedAt = receivedStr ? new Date(receivedStr) : new Date();
  if (Number.isNaN(receivedAt.getTime())) return { ok: false, error: 'invalid_date' };

  const reference = String(formData.get('reference') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim() || null;

  const scoped = forResidence(rec.ctx.residenceId);
  const call = await scoped.chargeCall.findUnique({
    where: { id: chargeCallId },
    select: { lotId: true },
  });
  if (!call) return { ok: false, error: 'not_found' };
  const payer = await scoped.lotAttachment.findFirst({
    where: { lotId: call.lotId, endDate: null, isChargePayer: true },
    select: { personId: true },
  });

  await writePayment(prismaTxRunner(), {
    residenceId: rec.ctx.residenceId,
    lotId: call.lotId,
    chargeCallId,
    payerPersonId: payer?.personId ?? null,
    recordedByPersonId: rec.ctx.personId,
    method,
    amountMinor,
    receivedAt,
    reference,
    note,
    actorPersonId: rec.ctx.personId,
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function reversePaymentAction(formData: FormData): Promise<PaymentActionResult> {
  const rec = await requirePaymentRecorder();
  if (!rec.ok) return { ok: false, error: rec.error };

  const paymentId = String(formData.get('paymentId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) return { ok: false, error: 'reason_required' };

  const res = await reversePayment(prismaTxRunner(), {
    residenceId: rec.ctx.residenceId,
    paymentId,
    reason,
    actorPersonId: rec.ctx.personId,
  });
  if (!res.ok) return { ok: false, error: res.reason };
  revalidatePath('/', 'layout');
  return { ok: true };
}
