/**
 * Moteur de détection des relances (E1) — cœur PUR, transcription §7.1. Prouve :
 * statuts concernés, seuil de retard, ANTI-HARCÈLEMENT (exclusion si relancé trop
 * récemment), tri par retard décroissant, et le respect des seuils de la règle
 * (jamais codés en dur).
 */
import { describe, it, expect } from 'vitest';
import { evaluateDunning, type DunningRule, type LotDunningInput } from './dunning';

const RULE: DunningRule = {
  overdueThresholdDays: 3,
  minDaysBetweenReminders: 4,
  concernedSettlementStates: ['PARTIAL', 'UNSETTLED'],
  lateFeeThresholdDays: 10,
};
const NOW = new Date('2026-08-14T12:00:00Z');

const lot = (over: Partial<LotDunningInput> = {}): LotDunningInput => ({
  lotId: 'lot-' + Math.random().toString(36).slice(2, 7),
  lotReference: 'A1',
  recipientPersonId: 'p1',
  recipientName: 'Youssef',
  recipientPhone: '+212661000000',
  recipientLocale: 'fr',
  calls: [
    {
      settlement: 'UNSETTLED',
      daysLate: 12,
      remainingMinor: 65000,
      periodYear: 2026,
      periodMonth: 7,
    },
  ],
  remindersSent: 0,
  lastReminderAt: null,
  ...over,
});

describe('evaluateDunning (§7.1)', () => {
  it('retient un impayé en retard ≥ seuil, calcule montant/retard/frais', () => {
    const item = evaluateDunning([lot()], RULE, NOW)[0]!;
    expect(item.amountDueMinor).toBe(65000);
    expect(item.retardDays).toBe(12);
    expect(item.lateFee).toBe(true); // 12 ≥ 10
  });

  it('exclut un lot soldé ou dont le retard est sous le seuil', () => {
    const settled = lot({
      calls: [
        {
          settlement: 'SETTLED',
          daysLate: 40,
          remainingMinor: 0,
          periodYear: 2026,
          periodMonth: 6,
        },
      ],
    });
    const notLate = lot({
      calls: [
        {
          settlement: 'UNSETTLED',
          daysLate: 2,
          remainingMinor: 65000,
          periodYear: 2026,
          periodMonth: 8,
        },
      ],
    });
    expect(evaluateDunning([settled, notLate], RULE, NOW)).toEqual([]);
  });

  it('ANTI-HARCÈLEMENT : exclut un lot relancé il y a moins de minDaysBetweenReminders', () => {
    const recent = lot({ lastReminderAt: new Date('2026-08-13T12:00:00Z') }); // 1 j → exclu
    const old = lot({ lastReminderAt: new Date('2026-08-08T12:00:00Z') }); // 6 j → retenu
    const res = evaluateDunning([recent, old], RULE, NOW);
    expect(res).toHaveLength(1);
    expect(res[0]!.lotId).toBe(old.lotId);
  });

  it('la règle est configurable : un seuil de retard plus élevé exclut', () => {
    const strict: DunningRule = { ...RULE, overdueThresholdDays: 30 };
    expect(
      evaluateDunning(
        [
          lot({
            calls: [
              {
                settlement: 'UNSETTLED',
                daysLate: 12,
                remainingMinor: 1,
                periodYear: 2026,
                periodMonth: 7,
              },
            ],
          }),
        ],
        strict,
        NOW,
      ),
    ).toEqual([]);
  });

  it('trie par retard décroissant', () => {
    const a = lot({
      lotReference: 'A',
      calls: [
        {
          settlement: 'UNSETTLED',
          daysLate: 5,
          remainingMinor: 1,
          periodYear: 2026,
          periodMonth: 8,
        },
      ],
    });
    const b = lot({
      lotReference: 'B',
      calls: [
        {
          settlement: 'PARTIAL',
          daysLate: 40,
          remainingMinor: 1,
          periodYear: 2026,
          periodMonth: 6,
        },
      ],
    });
    const c = lot({
      lotReference: 'C',
      calls: [
        {
          settlement: 'UNSETTLED',
          daysLate: 20,
          remainingMinor: 1,
          periodYear: 2026,
          periodMonth: 7,
        },
      ],
    });
    expect(evaluateDunning([a, b, c], RULE, NOW).map((i) => i.lotReference)).toEqual([
      'B',
      'C',
      'A',
    ]);
  });
});
