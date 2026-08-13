/**
 * Lecture d'un reçu pour impression (B3). Un reçu est un instantané comptable :
 * son numéro et son montant sont figés en base ; la réimpression rend donc TOUJOURS
 * le même document (le paiement est immuable). Un reçu voidé (encaissement annulé)
 * reste lisible mais porte la mention « annulé » — son numéro n'est jamais réutilisé.
 */
import { forResidence } from '@/server/db/tenant';
import { getBaseClient } from '@/server/db/client';
import { prismaExecutor } from '@/server/db/sql';
import { listResidents } from '@/server/auth/person-access';
import type { ActiveContext } from '@/server/auth/context';

export interface ReceiptPeriod {
  year: number;
  month: number;
}

export interface ReceiptView {
  id: string;
  number: string;
  issuedAt: string;
  voidedAt: string | null;
  amountMinor: number;
  method: string;
  receivedAt: string;
  reference: string | null;
  note: string | null;
  payerName: string | null;
  lotReference: string | null;
  recordedByName: string | null;
  periods: ReceiptPeriod[];
  residence: { name: string; address: string | null; city: string | null; orgName: string | null };
}

/** Reçu complet (en-tête résidence, payeur, lot, appels couverts) ou `null`. */
export async function getReceipt(
  ctx: ActiveContext,
  receiptId: string,
): Promise<ReceiptView | null> {
  const scoped = forResidence(ctx.residenceId);
  const receipt = await scoped.receipt.findUnique({
    where: { id: receiptId },
    select: {
      id: true,
      number: true,
      issuedAt: true,
      voidedAt: true,
      amountMinor: true,
      paymentId: true,
      lotId: true,
    },
  });
  if (!receipt) return null;

  const [payment, allocations, lot, residence, mandate] = await Promise.all([
    scoped.payment.findUnique({
      where: { id: receipt.paymentId },
      select: {
        method: true,
        receivedAt: true,
        reference: true,
        note: true,
        payerPersonId: true,
        recordedByPersonId: true,
      },
    }),
    scoped.paymentAllocation.findMany({
      where: { paymentId: receipt.paymentId },
      select: { chargeCall: { select: { periodYear: true, periodMonth: true } } },
    }),
    receipt.lotId
      ? scoped.lot.findUnique({ where: { id: receipt.lotId }, select: { reference: true } })
      : Promise.resolve(null),
    getBaseClient().residence.findUnique({
      where: { id: ctx.residenceId },
      select: { name: true, address: true, city: true },
    }),
    scoped.mandate.findFirst({
      where: { status: 'ACTIVE' },
      select: { organization: { select: { name: true } } },
    }),
  ]);
  if (!payment || !residence) return null;

  // Noms résolus via la couche d'accès aux personnes (jamais d'accès direct au modèle).
  const nameById = new Map<string, string>();
  for (const p of await listResidents(prismaExecutor(), ctx)) {
    nameById.set(p.id, `${p.firstName} ${p.lastName}`.trim());
  }

  const periods = allocations
    .map((a) => ({ year: a.chargeCall.periodYear, month: a.chargeCall.periodMonth }))
    .sort((a, b) => a.year - b.year || a.month - b.month);

  return {
    id: receipt.id,
    number: receipt.number,
    issuedAt: receipt.issuedAt.toISOString(),
    voidedAt: receipt.voidedAt ? receipt.voidedAt.toISOString() : null,
    amountMinor: receipt.amountMinor,
    method: payment.method,
    receivedAt: payment.receivedAt.toISOString(),
    reference: payment.reference,
    note: payment.note,
    payerName: payment.payerPersonId ? (nameById.get(payment.payerPersonId) ?? null) : null,
    lotReference: lot?.reference ?? null,
    recordedByName: payment.recordedByPersonId
      ? (nameById.get(payment.recordedByPersonId) ?? null)
      : null,
    periods,
    residence: {
      name: residence.name,
      address: residence.address,
      city: residence.city,
      orgName: mandate?.organization?.name ?? null,
    },
  };
}
