import { describe, it, expect } from 'vitest';
import {
  callAmountForLot,
  distributeByTantiemes,
  dueDateForPeriod,
  computeCampaignPlan,
  aggregateCampaigns,
} from './campaigns';

describe('callAmountForLot', () => {
  it('utilise la charge du lot si > 0, sinon le défaut résidence par type', () => {
    const def = { appt: 60000, villa: 120000 };
    expect(callAmountForLot({ type: 'APPARTEMENT', monthlyChargeMinor: 65000 }, def)).toBe(65000);
    expect(callAmountForLot({ type: 'APPARTEMENT', monthlyChargeMinor: 0 }, def)).toBe(60000);
    expect(callAmountForLot({ type: 'VILLA', monthlyChargeMinor: 0 }, def)).toBe(120000);
  });
});

describe('dueDateForPeriod', () => {
  it('pose le jour d’échéance, borné au dernier jour du mois', () => {
    expect(dueDateForPeriod({ year: 2026, month: 8 }, 1).toISOString().slice(0, 10)).toBe(
      '2026-08-01',
    );
    expect(dueDateForPeriod({ year: 2026, month: 2 }, 31).toISOString().slice(0, 10)).toBe(
      '2026-02-28',
    ); // borné au dernier jour de février
    expect(dueDateForPeriod({ year: 2026, month: 6 }, 15).toISOString().slice(0, 10)).toBe(
      '2026-06-15',
    );
  });
});

describe('distributeByTantiemes (pur) — répartition exacte au plus fort reste', () => {
  it('répartit sans perdre ni créer de centime', () => {
    const d = distributeByTantiemes(100000, [
      { id: 'a', quotePart: 1 },
      { id: 'b', quotePart: 1 },
      { id: 'c', quotePart: 1 },
    ]);
    const sum = [...d.values()].reduce((s, v) => s + v, 0);
    expect(sum).toBe(100000); // total EXACT
    expect(d.get('a')).toBe(33334); // le reste (1 centime) va au 1er (tie-break id)
    expect(d.get('b')).toBe(33333);
    expect(d.get('c')).toBe(33333);
  });
  it('proportionnel aux quotes-parts', () => {
    const d = distributeByTantiemes(100000, [
      { id: 'a', quotePart: 300 },
      { id: 'b', quotePart: 200 },
      { id: 'c', quotePart: 500 },
    ]);
    expect(d.get('a')).toBe(30000);
    expect(d.get('b')).toBe(20000);
    expect(d.get('c')).toBe(50000);
  });
  it('quote-part nulle → 0 ; total nul → tout à 0', () => {
    const d = distributeByTantiemes(100000, [
      { id: 'a', quotePart: 0 },
      { id: 'b', quotePart: 1 },
    ]);
    expect(d.get('a')).toBe(0);
    expect(d.get('b')).toBe(100000);
    const z = distributeByTantiemes(0, [{ id: 'a', quotePart: 1 }]);
    expect(z.get('a')).toBe(0);
  });
});

describe('computeCampaignPlan (aperçu, pur)', () => {
  const base = {
    period: { year: 2026, month: 8 },
    dueDate: new Date(Date.UTC(2026, 7, 1)),
    mode: 'FORFAIT' as const,
    monthlyBudgetMinor: 0,
    defaults: { appt: 60000, villa: 120000 },
  };

  it('forfait : appelle un lot vacant, dérive le redevable, ignore un lot déjà appelé', () => {
    const plan = computeCampaignPlan({
      ...base,
      lots: [
        { id: 'a', reference: 'A1', type: 'APPARTEMENT', monthlyChargeMinor: 65000, quotePart: 1 },
        { id: 'v', reference: 'V1', type: 'VILLA', monthlyChargeMinor: 0, quotePart: 2 }, // vacant → défaut villa
        { id: 'x', reference: 'A2', type: 'APPARTEMENT', monthlyChargeMinor: 65000, quotePart: 1 }, // déjà appelé
      ],
      existingLotIds: new Set(['x']),
      payerNameByLot: new Map([
        ['a', 'Youssef Chraibi'],
        ['v', 'Sara Tahiri'], // propriétaire d'un lot vacant : reste redevable
        ['x', 'Amine Moussaoui'],
      ]),
    });

    expect(plan.mode).toBe('FORFAIT');
    expect(plan.toCallCount).toBe(2);
    expect(plan.alreadyCalledCount).toBe(1);
    expect(plan.totalToCallMinor).toBe(65000 + 120000);

    const v = plan.lines.find((l) => l.lotId === 'v')!;
    expect(v.amountMinor).toBe(120000); // défaut villa appliqué
    expect(v.payerName).toBe('Sara Tahiri'); // le propriétaire reste redevable, lot vacant
    expect(plan.lines.find((l) => l.lotId === 'x')!.alreadyCalled).toBe(true);
  });

  it('tantièmes : répartit le budget mensuel aux quotes-parts', () => {
    const plan = computeCampaignPlan({
      ...base,
      mode: 'TANTIEMES',
      monthlyBudgetMinor: 100000,
      lots: [
        { id: 'a', reference: 'A1', type: 'APPARTEMENT', monthlyChargeMinor: 99999, quotePart: 300 },
        { id: 'b', reference: 'A2', type: 'APPARTEMENT', monthlyChargeMinor: 0, quotePart: 200 },
        { id: 'c', reference: 'V1', type: 'VILLA', monthlyChargeMinor: 0, quotePart: 500 },
      ],
      existingLotIds: new Set(),
      payerNameByLot: new Map(),
    });
    expect(plan.mode).toBe('TANTIEMES');
    expect(plan.totalQuotePart).toBe(1000);
    // Le forfait par lot est IGNORÉ : c'est la quote-part qui décide.
    expect(plan.lines.find((l) => l.lotId === 'a')!.amountMinor).toBe(30000);
    expect(plan.lines.find((l) => l.lotId === 'c')!.amountMinor).toBe(50000);
    expect(plan.totalToCallMinor).toBe(100000);
  });
});

describe('aggregateCampaigns (suivi, pur)', () => {
  it('agrège par période : appelé, encaissé (capé), reste dû, taux — trié desc', () => {
    const aout = new Date(Date.UTC(2026, 7, 1));
    const juillet = new Date(Date.UTC(2026, 6, 1));
    const out = aggregateCampaigns(
      [
        { id: 'c1', periodYear: 2026, periodMonth: 8, amountMinor: 65000, dueDate: aout },
        { id: 'c2', periodYear: 2026, periodMonth: 8, amountMinor: 120000, dueDate: aout },
        { id: 'c3', periodYear: 2026, periodMonth: 7, amountMinor: 65000, dueDate: juillet },
      ],
      [
        { chargeCallId: 'c1', amountMinor: 65000 }, // soldé
        { chargeCallId: 'c2', amountMinor: 60000 }, // partiel
        { chargeCallId: 'c3', amountMinor: 70000 }, // sur-payé → capé à 65000
      ],
    );

    expect(out.map((o) => o.month)).toEqual([8, 7]); // trié descendant
    expect(out[0]).toMatchObject({
      month: 8,
      lotsCalled: 2,
      totalCalledMinor: 185000,
      totalCollectedMinor: 125000,
      remainingMinor: 60000,
    });
    expect(out[0]!.collectionRate).toBeCloseTo(125000 / 185000);
    expect(out[1]).toMatchObject({ month: 7, totalCollectedMinor: 65000, remainingMinor: 0 });
    expect(out[1]!.collectionRate).toBe(1);
  });
});
