/**
 * Cœur PUR du relevé de compte (B4). Prouve : débit (appel) / crédit (règlement) /
 * re-débit (annulation), ordre chronologique (appel avant règlement à date égale),
 * solde courant et solde de clôture = total appelé − net réglé (le reste dû).
 */
import { describe, it, expect } from 'vitest';
import { buildLedger, type LedgerCall, type LedgerPayment } from './account';

const NO_RECEIPTS = new Map();
const call = (y: number, m: number, day: number, amount: number): LedgerCall => ({
  periodYear: y,
  periodMonth: m,
  dueDate: new Date(Date.UTC(y, m - 1, day)),
  amountMinor: amount,
});
const pay = (
  id: string,
  iso: string,
  amount: number,
  reverses: string | null = null,
): LedgerPayment => ({
  id,
  method: amount < 0 ? 'VIREMENT' : 'ESPECES',
  amountMinor: amount,
  receivedAt: new Date(iso),
  reversesPaymentId: reverses,
});

describe('buildLedger', () => {
  it('débite les appels, crédite les règlements, calcule le solde courant', () => {
    const l = buildLedger(
      [call(2026, 1, 1, 65000), call(2026, 2, 1, 65000)],
      [pay('p1', '2026-01-05T00:00:00Z', 65000)],
      NO_RECEIPTS,
    );
    // Ordre : appel janv (débit) → règlement (crédit) → appel févr (débit)
    expect(l.entries.map((e) => [e.kind, e.debitMinor, e.creditMinor, e.balanceMinor])).toEqual([
      ['charge', 65000, 0, 65000],
      ['payment', 0, 65000, 0],
      ['charge', 65000, 0, 65000],
    ]);
    expect(l.totalDebitMinor).toBe(130000);
    expect(l.totalCreditMinor).toBe(65000);
    expect(l.balanceMinor).toBe(65000); // reste dû = un appel non réglé
  });

  it('à date égale, l’appel précède le règlement', () => {
    const l = buildLedger(
      [call(2026, 1, 1, 65000)],
      [pay('p1', '2026-01-01T00:00:00Z', 65000)],
      NO_RECEIPTS,
    );
    expect(l.entries.map((e) => e.kind)).toEqual(['charge', 'payment']);
    expect(l.balanceMinor).toBe(0);
  });

  it('une annulation (paiement négatif) re-débite le compte', () => {
    const l = buildLedger(
      [call(2026, 1, 1, 65000)],
      [pay('p1', '2026-01-05T00:00:00Z', 65000), pay('rev', '2026-01-10T00:00:00Z', -65000, 'p1')],
      NO_RECEIPTS,
    );
    expect(l.entries.map((e) => [e.kind, e.debitMinor, e.creditMinor, e.balanceMinor])).toEqual([
      ['charge', 65000, 0, 65000],
      ['payment', 0, 65000, 0],
      ['reversal', 65000, 0, 65000],
    ]);
    expect(l.balanceMinor).toBe(65000); // l'appel redevient dû
  });

  it('rattache le numéro de reçu au règlement', () => {
    const l = buildLedger(
      [call(2026, 1, 1, 65000)],
      [pay('p1', '2026-01-05T00:00:00Z', 65000)],
      new Map([['p1', { id: 'rec1', number: 'REC-2026-0001', voided: false }]]),
    );
    const payment = l.entries.find((e) => e.kind === 'payment')!;
    expect(payment.receiptNumber).toBe('REC-2026-0001');
    expect(payment.receiptVoided).toBe(false);
  });

  it('compte vide : solde nul', () => {
    const l = buildLedger([], [], NO_RECEIPTS);
    expect(l.entries).toEqual([]);
    expect(l.balanceMinor).toBe(0);
  });

  it('une régularisation débite (supplément) ou crédite (avoir) le compte', () => {
    const l = buildLedger(
      [call(2026, 1, 1, 65000)],
      [pay('p1', '2026-01-05T00:00:00Z', 65000)],
      NO_RECEIPTS,
      [],
      [
        { effectiveOn: new Date(Date.UTC(2026, 11, 31)), exercice: 2026, adjustmentMinor: 12000 },
      ],
    );
    const reg = l.entries.find((e) => e.kind === 'regularisation')!;
    expect([reg.debitMinor, reg.creditMinor, reg.periodYear]).toEqual([12000, 0, 2026]);
    expect(l.balanceMinor).toBe(12000); // appel réglé, supplément reste dû

    const credit = buildLedger([], [], NO_RECEIPTS, [], [
      { effectiveOn: new Date(Date.UTC(2026, 11, 31)), exercice: 2026, adjustmentMinor: -5000 },
    ]);
    const avoir = credit.entries[0]!;
    expect([avoir.debitMinor, avoir.creditMinor]).toEqual([0, 5000]);
    expect(credit.balanceMinor).toBe(-5000); // avoir en faveur du lot
  });
});
