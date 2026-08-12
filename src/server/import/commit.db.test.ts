/**
 * Import — écriture transactionnelle (A7 §3), invariants au niveau base. Tourne sur
 * PGlite (gate) ET sur Postgres réel (`npm run test:pg`). Prouve : dédoublonnage MRE,
 * idempotence, tout-ou-rien, répartition des quotes-parts sur 1000.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  freshDb,
  pgliteExecutor,
  pgliteTxRunner,
  insertResidence,
  type TestDb,
} from '@/test/pglite';
import type { SqlExecutor, TxRunner } from '@/server/db/sql';
import { commitImport } from './commit';
import { planImport } from './plan';
import type { ParsedSheet, RawRow } from './parse';
import type { Column } from './normalize';

let db: TestDb;
let exec: SqlExecutor;
let runner: TxRunner;
const CTX = { residenceId: 'res-1', role: 'SYNDIC' } as const;

beforeEach(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);
  runner = pgliteTxRunner(db);
  await insertResidence(db, 'res-1');
});

function sheet(rows: Array<Partial<Record<Column, string>>>, columns: Column[]): ParsedSheet {
  const raw: RawRow[] = rows.map((values, i) => ({ rowNumber: i + 2, values }));
  return { rows: raw, recognizedColumns: columns };
}

async function existingRefs(): Promise<Set<string>> {
  const rows = await exec.query<{ reference: string }>(
    'SELECT reference FROM "Lot" WHERE "residenceId" = $1',
    ['res-1'],
  );
  return new Set(rows.map((r) => r.reference));
}

async function counts() {
  const lots = await exec.query<{ n: number }>('SELECT count(*)::int AS n FROM "Lot"');
  const persons = await exec.query<{ n: number }>('SELECT count(*)::int AS n FROM "Person"');
  const atts = await exec.query<{ n: number }>('SELECT count(*)::int AS n FROM "LotAttachment"');
  return { lots: lots[0]!.n, persons: persons[0]!.n, attachments: atts[0]!.n };
}

async function run(rows: Array<Partial<Record<Column, string>>>, columns: Column[]) {
  const plan = planImport(sheet(rows, columns), await existingRefs());
  const createRows = plan.rows.filter((r) => r.status === 'create');
  const ignored = plan.counts.exists + plan.counts.reject;
  return commitImport(runner, CTX, createRows, plan.hasQuotePartColumn, ignored);
}

describe('commitImport — écriture transactionnelle', () => {
  it('un fichier de références seules crée les lots (quotes-parts réparties sur 1000)', async () => {
    const report = await run(
      [{ reference: 'A1' }, { reference: 'A2' }, { reference: 'A3' }],
      ['reference'],
    );
    expect(report.lotsCreated).toBe(3);
    const qp = await exec.query<{ quotePart: number }>('SELECT "quotePart" FROM "Lot"');
    expect(qp.reduce((s, r) => s + r.quotePart, 0)).toBe(1000); // total exact
  });

  it('deux lots du même propriétaire ne créent qu’UNE personne (dédoublonnage MRE)', async () => {
    const cols: Column[] = ['reference', 'ownerName', 'ownerEmail'];
    const report = await run(
      [
        { reference: 'M1', ownerName: 'Nadia Ouazzani', ownerEmail: 'nadia@example.ma' },
        { reference: 'M2', ownerName: 'Nadia Ouazzani', ownerEmail: 'nadia@example.ma' },
      ],
      cols,
    );
    expect(report.lotsCreated).toBe(2);
    expect(report.personsCreated).toBe(1); // une seule personne
    expect(report.personsAttached).toBe(2); // mais deux rattachements
    expect((await counts()).persons).toBe(1);
  });

  it('réimporter le même fichier ne duplique rien (idempotence)', async () => {
    const rows = [{ reference: 'R1', ownerName: 'A B', ownerEmail: 'ab@example.ma' }];
    const cols: Column[] = ['reference', 'ownerName', 'ownerEmail'];
    await run(rows, cols);
    const first = await counts();
    const second = await run(rows, cols); // même fichier
    expect(second.lotsCreated).toBe(0);
    expect(second.personsCreated).toBe(0);
    expect(second.ignored).toBe(1); // la ligne « exists »
    expect(await counts()).toEqual(first); // rien n’a bougé
  });

  it('tout-ou-rien : une contrainte violée en cours d’import n’écrit RIEN', async () => {
    // Deux lignes valides + un doublon actif de propriétaire sur le MÊME lot est
    // impossible ici ; on force plutôt une violation en pré-insérant une référence
    // puis en la contournant : on écrit directement un lot en double via SQL.
    // Plus simple : deux lignes créent le même lot après contournement du plan.
    const createRows = planImport(
      sheet([{ reference: 'Z1' }, { reference: 'Z2' }], ['reference']),
      new Set(),
    ).rows.filter((r) => r.status === 'create');
    // On sabote la 2e ligne pour référencer Z1 (doublon → viole @@unique).
    createRows[1]!.lot!.reference = 'Z1';
    createRows[1]!.reference = 'Z1';

    await expect(commitImport(runner, CTX, createRows, false, 0)).rejects.toThrow();
    expect((await counts()).lots).toBe(0); // aucune écriture partielle
  });

  it('propriétaire redevable par défaut ; locataire redevable si délégation', async () => {
    await run(
      [
        {
          reference: 'D1',
          ownerName: 'Prop A',
          tenantName: 'Loc B',
          tenantDelegated: 'oui',
        },
      ],
      ['reference', 'ownerName', 'tenantName', 'tenantDelegated'],
    );
    const payers = await exec.query<{ role: string; isChargePayer: boolean }>(
      'SELECT role, "isChargePayer" FROM "LotAttachment" ORDER BY role',
    );
    // OWNER non redevable, TENANT redevable (délégation)
    const owner = payers.find((p) => p.role === 'OWNER')!;
    const tenant = payers.find((p) => p.role === 'TENANT')!;
    expect(owner.isChargePayer).toBe(false);
    expect(tenant.isChargePayer).toBe(true);
  });
});
