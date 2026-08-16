/**
 * Fonds de provisions travaux (I2) — invariants DB. L'annulation d'une contribution par
 * ÉCRITURE INVERSE (gardes), le solde net du fonds, et la SÉPARATION stricte d'avec la
 * trésorerie courante (les dépenses `onWorksFund` n'entrent jamais dans le courant).
 * PGlite et Postgres réel.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { TestDb } from '@/test/pglite';
import { freshDb, pgliteTxRunner, insertResidence } from '@/test/pglite';
import { reverseWorksFundContribution } from './works-fund';
import { writeExpense } from './expenses';

let db: TestDb;

async function insertContribution(
  d: TestDb,
  o: { id: string; residenceId: string; amountMinor: number; label?: string; reverses?: string | null },
): Promise<void> {
  await d.query(
    `INSERT INTO "WorksFundContribution"(id,"residenceId","amountMinor",label,"occurredOn","reversesContributionId")
     VALUES ($1,$2,$3,$4,CURRENT_DATE,$5)`,
    [o.id, o.residenceId, o.amountMinor, o.label ?? 'Appel travaux', o.reverses ?? null],
  );
}

async function fundNet(residenceId: string): Promise<number> {
  const contrib = await db.query<{ s: number }>(
    `SELECT COALESCE(SUM("amountMinor"),0)::int AS s FROM "WorksFundContribution" WHERE "residenceId" = $1`,
    [residenceId],
  );
  const spent = await db.query<{ s: number }>(
    `SELECT COALESCE(SUM("amountMinor"),0)::int AS s FROM "Expense" WHERE "residenceId" = $1 AND "onWorksFund" = true`,
    [residenceId],
  );
  return contrib.rows[0]!.s - spent.rows[0]!.s;
}

beforeAll(async () => {
  db = await freshDb();
  await insertResidence(db, 'res-1');
});

describe('reverseWorksFundContribution — écriture inverse, gardes', () => {
  it("crée un inverse négatif, refuse une double annulation et l'annulation d'un inverse", async () => {
    const runner = pgliteTxRunner(db);
    await insertContribution(db, { id: 'wf-1', residenceId: 'res-1', amountMinor: 50000 });

    const r1 = await reverseWorksFundContribution(runner, {
      residenceId: 'res-1',
      contributionId: 'wf-1',
      actorPersonId: 'p-staff',
    });
    expect(r1.ok).toBe(true);
    const rows = await db.query<{ amountMinor: number }>(
      `SELECT "amountMinor" FROM "WorksFundContribution" WHERE "reversesContributionId" = 'wf-1'`,
    );
    expect(rows.rows[0]!.amountMinor).toBe(-50000);

    // double annulation refusée
    const r2 = await reverseWorksFundContribution(runner, {
      residenceId: 'res-1',
      contributionId: 'wf-1',
      actorPersonId: 'p',
    });
    expect(r2).toEqual({ ok: false, reason: 'already_reversed' });

    // annuler un inverse est refusé
    const revId = (r1 as { ok: true; reversalId: string }).reversalId;
    const r3 = await reverseWorksFundContribution(runner, {
      residenceId: 'res-1',
      contributionId: revId,
      actorPersonId: 'p',
    });
    expect(r3).toEqual({ ok: false, reason: 'is_reversal' });

    // introuvable
    const r4 = await reverseWorksFundContribution(runner, {
      residenceId: 'res-1',
      contributionId: 'nope',
      actorPersonId: 'p',
    });
    expect(r4).toEqual({ ok: false, reason: 'not_found' });

    // l'audit trace l'annulation
    const audit = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "AuditLog" WHERE action = 'worksfund.reverse'`,
    );
    expect(audit.rows[0]!.n).toBe(1);
  });
});

describe('solde net + séparation d’avec la trésorerie courante', () => {
  it('le solde suit les contributions (annulations comprises) moins les dépenses du fonds', async () => {
    await insertResidence(db, 'res-2');
    const runner = pgliteTxRunner(db);
    await insertContribution(db, { id: 'c-a', residenceId: 'res-2', amountMinor: 80000 });
    await insertContribution(db, { id: 'c-b', residenceId: 'res-2', amountMinor: 20000 });

    // une dépense COURANTE (onWorksFund=false) ne touche pas le fonds
    await writeExpense(runner, {
      residenceId: 'res-2',
      categoryId: null,
      description: 'Électricité communs',
      amountMinor: 15000,
      spentOn: new Date('2026-03-10T00:00:00Z'),
      supplierName: 'RADEEMA',
      visibility: 'PARTAGE',
      justificatifId: null,
      onWorksFund: false,
      actorPersonId: 'p',
    });
    // une dépense imputée AU FONDS
    await writeExpense(runner, {
      residenceId: 'res-2',
      categoryId: null,
      description: 'Ravalement façade',
      amountMinor: 28000,
      spentOn: new Date('2026-03-11T00:00:00Z'),
      supplierName: 'BTP Atlas',
      visibility: 'PARTAGE',
      justificatifId: null,
      onWorksFund: true,
      actorPersonId: 'p',
    });

    // solde du fonds = 80000 + 20000 − 28000 = 72000 (la dépense courante n'y entre pas)
    expect(await fundNet('res-2')).toBe(72000);

    // annuler la 2e contribution ré-augmente le solde de 20000 → 52000
    const rev = await reverseWorksFundContribution(runner, {
      residenceId: 'res-2',
      contributionId: 'c-b',
      actorPersonId: 'p',
    });
    expect(rev.ok).toBe(true);
    expect(await fundNet('res-2')).toBe(52000);

    // le courant (onWorksFund=false) ne contient QUE la dépense d'électricité
    const current = await db.query<{ s: number }>(
      `SELECT COALESCE(SUM("amountMinor"),0)::int AS s FROM "Expense" WHERE "residenceId" = 'res-2' AND "onWorksFund" = false`,
    );
    expect(current.rows[0]!.s).toBe(15000);
  });
});
