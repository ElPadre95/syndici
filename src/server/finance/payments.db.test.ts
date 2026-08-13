/**
 * Encaissement (B2) — invariants au niveau base. PGlite (gate) ET Postgres réel
 * (`npm run test:pg`). Prouve : allocation à l'appel, partiels & paiements multiples,
 * annulation par écriture inverse (statut redevient « non réglé » par dérivation),
 * immuabilité de l'original, refus d'annuler une annulation ou un paiement déjà annulé.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  freshDb,
  pgliteExecutor,
  pgliteTxRunner,
  insertResidence,
  insertLot,
  insertPerson,
  type TestDb,
} from '@/test/pglite';
import type { SqlExecutor, TxRunner } from '@/server/db/sql';
import { writePayment, reversePayment, type RecordPaymentInput } from './payments';

let db: TestDb;
let exec: SqlExecutor;
let runner: TxRunner;
const RES = 'res-1';

beforeEach(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);
  runner = pgliteTxRunner(db);
  await insertResidence(db, RES);
  await insertPerson(db, 'payer');
  await insertPerson(db, 'recorder');
  await insertLot(db, 'lot-1', RES, 'A1');
  await db.query(
    `INSERT INTO "ChargeCall"(id,"residenceId","lotId","periodYear","periodMonth","dueDate","amountMinor")
     VALUES ('call-1',$1,'lot-1',2026,8,'2026-08-01'::date,65000)`,
    [RES],
  );
});

const base = (over: Partial<RecordPaymentInput>): RecordPaymentInput => ({
  residenceId: RES,
  lotId: 'lot-1',
  chargeCallId: 'call-1',
  payerPersonId: 'payer',
  recordedByPersonId: 'recorder',
  method: 'ESPECES',
  amountMinor: 65000,
  receivedAt: new Date('2026-08-05T00:00:00Z'),
  reference: null,
  note: null,
  actorPersonId: 'recorder',
  ...over,
});

async function allocOf(callId: string): Promise<number> {
  return (
    await exec.query<{ s: number }>(
      `SELECT COALESCE(SUM("amountMinor"),0)::int AS s FROM "PaymentAllocation" WHERE "chargeCallId" = $1`,
      [callId],
    )
  )[0]!.s;
}
async function paymentCount(): Promise<number> {
  return (await exec.query<{ n: number }>('SELECT count(*)::int AS n FROM "Payment"'))[0]!.n;
}
async function auditCount(action: string): Promise<number> {
  return (
    await exec.query<{ n: number }>(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action = $1`, [
      action,
    ])
  )[0]!.n;
}
async function receiptFor(
  paymentId: string,
): Promise<{ number: string; amountMinor: number; voided: boolean } | null> {
  const rows = await exec.query<{ number: string; amountMinor: number; voidedAt: string | null }>(
    `SELECT number, "amountMinor", "voidedAt" FROM "Receipt" WHERE "paymentId" = $1`,
    [paymentId],
  );
  const r = rows[0];
  return r ? { number: r.number, amountMinor: r.amountMinor, voided: r.voidedAt != null } : null;
}

describe('writePayment', () => {
  it('crée un paiement, l’alloue à l’appel, et trace l’audit', async () => {
    const id = await writePayment(runner, base({ method: 'CHEQUE', reference: 'CHQ-42' }));
    expect(id).toBeTruthy();
    expect(await paymentCount()).toBe(1);
    expect(await allocOf('call-1')).toBe(65000); // soldé (dérivé)
    expect(await auditCount('payment.record')).toBe(1);
  });

  it('partiels & paiements multiples s’additionnent', async () => {
    await writePayment(runner, base({ amountMinor: 30000 }));
    expect(await allocOf('call-1')).toBe(30000); // partiel
    await writePayment(runner, base({ amountMinor: 20000, method: 'VIREMENT' }));
    expect(await allocOf('call-1')).toBe(50000); // toujours partiel
    expect(await paymentCount()).toBe(2);
  });
});

describe('reçu (B3) — émission séquentielle & annulation', () => {
  it('émet un reçu numéroté (REC-<exercice>-<seq>) et trace l’audit receipt.issue', async () => {
    const id = await writePayment(runner, base({ amountMinor: 65000 }));
    const rec = await receiptFor(id);
    expect(rec).toEqual({ number: 'REC-2026-0001', amountMinor: 65000, voided: false });
    expect(await auditCount('receipt.issue')).toBe(1);
  });

  it('numérote de façon CONTINUE et SANS TROU par exercice', async () => {
    const a = await writePayment(runner, base({ amountMinor: 10000 }));
    const b = await writePayment(runner, base({ amountMinor: 10000 }));
    const c = await writePayment(runner, base({ amountMinor: 10000 }));
    expect((await receiptFor(a))!.number).toBe('REC-2026-0001');
    expect((await receiptFor(b))!.number).toBe('REC-2026-0002');
    expect((await receiptFor(c))!.number).toBe('REC-2026-0003');
  });

  it('l’exercice suit l’année d’encaissement', async () => {
    const id = await writePayment(
      runner,
      base({ amountMinor: 10000, receivedAt: new Date('2027-01-03T00:00:00Z') }),
    );
    expect((await receiptFor(id))!.number).toBe('REC-2027-0001');
  });

  it('annuler un paiement VOIDe son reçu (le numéro est conservé)', async () => {
    const id = await writePayment(runner, base({ amountMinor: 65000 }));
    const before = await receiptFor(id);
    expect(before!.voided).toBe(false);

    const res = await reversePayment(runner, {
      residenceId: RES,
      paymentId: id,
      reason: 'Chèque sans provision',
      actorPersonId: 'recorder',
    });
    expect(res.ok).toBe(true);

    const after = await receiptFor(id);
    expect(after).toEqual({ number: before!.number, amountMinor: 65000, voided: true }); // numéro conservé, voidé
    // l'écriture inverse (paiement négatif) ne porte PAS de reçu
    const reversalId = (
      await exec.query<{ id: string }>(`SELECT id FROM "Payment" WHERE "reversesPaymentId" = $1`, [
        id,
      ])
    )[0]!.id;
    expect(await receiptFor(reversalId)).toBeNull();
  });
});

describe('reversePayment (annulation par écriture inverse)', () => {
  it('annule par écriture négative : l’appel redevient non soldé, l’original intact', async () => {
    const id = await writePayment(runner, base({ amountMinor: 65000 }));
    expect(await allocOf('call-1')).toBe(65000);

    const res = await reversePayment(runner, {
      residenceId: RES,
      paymentId: id,
      reason: 'Chèque sans provision',
      actorPersonId: 'recorder',
    });
    expect(res.ok).toBe(true);
    expect(await allocOf('call-1')).toBe(0); // net = 65000 - 65000
    expect(await paymentCount()).toBe(2); // original + annulation (l'original n'est jamais supprimé)
    expect(await auditCount('payment.reverse')).toBe(1);

    // l'original existe toujours, montant inchangé ; l'annulation le lie et est négative
    const orig = await exec.query<{ amountMinor: number }>(
      `SELECT "amountMinor" FROM "Payment" WHERE id = $1`,
      [id],
    );
    expect(orig[0]!.amountMinor).toBe(65000);
    const rev = await exec.query<{ amountMinor: number }>(
      `SELECT "amountMinor" FROM "Payment" WHERE "reversesPaymentId" = $1`,
      [id],
    );
    expect(rev[0]!.amountMinor).toBe(-65000);
  });

  it('refuse d’annuler un paiement déjà annulé', async () => {
    const id = await writePayment(runner, base({}));
    await reversePayment(runner, {
      residenceId: RES,
      paymentId: id,
      reason: 'x',
      actorPersonId: 'recorder',
    });
    const second = await reversePayment(runner, {
      residenceId: RES,
      paymentId: id,
      reason: 'x',
      actorPersonId: 'recorder',
    });
    expect(second).toEqual({ ok: false, reason: 'already_reversed' });
  });

  it('refuse d’annuler une annulation', async () => {
    const id = await writePayment(runner, base({}));
    const r = await reversePayment(runner, {
      residenceId: RES,
      paymentId: id,
      reason: 'x',
      actorPersonId: 'recorder',
    });
    expect(r.ok).toBe(true);
    const reversalId = r.ok ? r.reversalId : '';
    const again = await reversePayment(runner, {
      residenceId: RES,
      paymentId: reversalId,
      reason: 'x',
      actorPersonId: 'recorder',
    });
    expect(again).toEqual({ ok: false, reason: 'is_reversal' });
  });

  it('refuse un paiement introuvable', async () => {
    const r = await reversePayment(runner, {
      residenceId: RES,
      paymentId: 'nope',
      reason: 'x',
      actorPersonId: 'recorder',
    });
    expect(r).toEqual({ ok: false, reason: 'not_found' });
  });
});
