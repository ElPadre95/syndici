/**
 * Frais de retard (H2) — cœur pur + écriture inverse + garantie d'idempotence (contrainte
 * DB). PGlite et Postgres réel.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { TestDb } from '@/test/pglite';
import { freshDb, pgliteTxRunner, insertResidence, insertLot } from '@/test/pglite';
import { computeLateFeeMinor, reverseLateFee } from './late-fees';
import { buildLedger, type LedgerLateFee } from './account';

describe('computeLateFeeMinor (pur)', () => {
  it('part fixe + pourcentage, plafonné', () => {
    // 50 DH fixes + 5 % de 1000 DH = 50 + 50 = 100 DH.
    expect(computeLateFeeMinor(100000, { fixedMinor: 5000, percentBps: 500, capMinor: null })).toBe(10000);
    // plafond 80 DH appliqué.
    expect(computeLateFeeMinor(100000, { fixedMinor: 5000, percentBps: 500, capMinor: 8000 })).toBe(8000);
    // rien dû → aucun frais.
    expect(computeLateFeeMinor(0, { fixedMinor: 5000, percentBps: 500, capMinor: null })).toBe(0);
    // config vide → 0.
    expect(computeLateFeeMinor(100000, { fixedMinor: 0, percentBps: 0, capMinor: null })).toBe(0);
  });
});

describe('buildLedger — le frais débite, son annulation re-crédite', () => {
  it('un frais est un débit ; son inverse un crédit ; le solde suit', () => {
    const d = (s: string) => new Date(s);
    const lateFees: LedgerLateFee[] = [
      { appliedAt: d('2026-03-10'), amountMinor: 10000, reversesLateFeeId: null },
      { appliedAt: d('2026-03-12'), amountMinor: -10000, reversesLateFeeId: 'lf-1' },
    ];
    const ledger = buildLedger([], [], new Map(), lateFees);
    expect(ledger.entries.map((e) => e.kind)).toEqual(['latefee', 'latefee_reversal']);
    expect(ledger.entries[0]!.debitMinor).toBe(10000);
    expect(ledger.entries[1]!.creditMinor).toBe(10000);
    expect(ledger.balanceMinor).toBe(0); // frais annulé → solde nul
  });

  it("à date égale, le frais (débit) précède le paiement (crédit)", () => {
    const d = (s: string) => new Date(s);
    const ledger = buildLedger(
      [],
      [{ id: 'p1', method: 'ESPECES', amountMinor: 10000, receivedAt: d('2026-03-10'), reversesPaymentId: null }],
      new Map(),
      [{ appliedAt: d('2026-03-10'), amountMinor: 10000, reversesLateFeeId: null }],
    );
    expect(ledger.entries.map((e) => e.kind)).toEqual(['latefee', 'payment']);
    expect(ledger.balanceMinor).toBe(0);
  });
});

let db: TestDb;

async function insertLateFee(
  d: TestDb,
  o: { id: string; residenceId: string; lotId: string; chargeCallId: string | null; amountMinor: number },
): Promise<void> {
  await d.query(
    `INSERT INTO "LateFee"(id,"residenceId","lotId","chargeCallId","amountMinor")
     VALUES ($1,$2,$3,$4,$5)`,
    [o.id, o.residenceId, o.lotId, o.chargeCallId, o.amountMinor],
  );
}

async function insertCharge(d: TestDb, id: string, month: number): Promise<void> {
  await d.query(
    `INSERT INTO "ChargeCall"(id,"residenceId","lotId","periodYear","periodMonth","dueDate","amountMinor")
     VALUES ($1,'res-1','lot-1',2026,$2,'2026-01-01'::date,50000)`,
    [id, month],
  );
}

beforeAll(async () => {
  db = await freshDb();
  await insertResidence(db, 'res-1');
  await insertLot(db, 'lot-1', 'res-1', 'A1');
  await insertCharge(db, 'call-x', 3);
  await insertCharge(db, 'call-1', 4);
});

describe('idempotence — au plus un frais par appel (contrainte DB)', () => {
  it("un second frais sur le MÊME appel est refusé (repasser le job ne double jamais)", async () => {
    await insertLateFee(db, { id: 'lf-a', residenceId: 'res-1', lotId: 'lot-1', chargeCallId: 'call-x', amountMinor: 5000 });
    await expect(
      insertLateFee(db, { id: 'lf-b', residenceId: 'res-1', lotId: 'lot-1', chargeCallId: 'call-x', amountMinor: 5000 }),
    ).rejects.toThrow();
  });
});

describe('reverseLateFee — écriture inverse, gardes', () => {
  it('crée un inverse négatif, refuse une double annulation et l\'annulation d\'un inverse', async () => {
    const runner = pgliteTxRunner(db);
    await insertLateFee(db, { id: 'lf-1', residenceId: 'res-1', lotId: 'lot-1', chargeCallId: 'call-1', amountMinor: 7000 });

    const r1 = await reverseLateFee(runner, { residenceId: 'res-1', lateFeeId: 'lf-1', reason: 'geste commercial', actorPersonId: 'p-staff' });
    expect(r1.ok).toBe(true);
    const rows = await db.query<{ amountMinor: number; reversesLateFeeId: string | null; chargeCallId: string | null }>(
      `SELECT "amountMinor","reversesLateFeeId","chargeCallId" FROM "LateFee" WHERE "reversesLateFeeId" = 'lf-1'`,
    );
    expect(rows.rows[0]!.amountMinor).toBe(-7000);
    expect(rows.rows[0]!.chargeCallId).toBeNull(); // l'inverse ne bloque pas l'unicité

    // double annulation refusée
    const r2 = await reverseLateFee(runner, { residenceId: 'res-1', lateFeeId: 'lf-1', reason: 'x', actorPersonId: 'p' });
    expect(r2).toEqual({ ok: false, reason: 'already_reversed' });

    // annuler un inverse est refusé
    const revId = (r1 as { ok: true; reversalId: string }).reversalId;
    const r3 = await reverseLateFee(runner, { residenceId: 'res-1', lateFeeId: revId, reason: 'x', actorPersonId: 'p' });
    expect(r3).toEqual({ ok: false, reason: 'is_reversal' });

    // introuvable
    const r4 = await reverseLateFee(runner, { residenceId: 'res-1', lateFeeId: 'nope', reason: 'x', actorPersonId: 'p' });
    expect(r4).toEqual({ ok: false, reason: 'not_found' });
  });
});
