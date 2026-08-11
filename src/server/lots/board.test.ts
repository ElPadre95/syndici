import { describe, it, expect } from 'vitest';
import { assembleBoard, type AssembleInput } from './board';

const now = new Date('2026-08-11');
const due = new Date('2026-06-01'); // échu

function baseInput(canSeeIdentities: boolean): AssembleInput {
  return {
    lots: [
      { id: 'L1', reference: 'A1', type: 'APPARTEMENT', floor: 'A', monthlyChargeMinor: 65000 },
      { id: 'L2', reference: 'V1', type: 'VILLA', floor: null, monthlyChargeMinor: 120000 },
      { id: 'L3', reference: 'A2', type: 'APPARTEMENT', floor: 'A', monthlyChargeMinor: 65000 },
    ],
    attachments: [
      { lotId: 'L1', personId: 'pOwner', role: 'OWNER', isChargePayer: false },
      { lotId: 'L1', personId: 'pTenant', role: 'TENANT', isChargePayer: true }, // délégué
      { lotId: 'L2', personId: 'pLocal', role: 'OWNER', isChargePayer: true },
      // L3 : aucun rattachement → vacant
    ],
    persons: new Map([
      ['pOwner', { firstName: 'Sara', lastName: 'Tahiri', nationality: 'France' }],
      ['pTenant', { firstName: 'Hind', lastName: 'Locataire', nationality: 'Maroc' }],
      ['pLocal', { firstName: 'Karim', lastName: 'Benali', nationality: 'Maroc' }],
    ]),
    calls: [
      { id: 'c1', lotId: 'L1', amountMinor: 65000, dueDate: due },
      { id: 'c2', lotId: 'L2', amountMinor: 120000, dueDate: due },
    ],
    allocations: [{ chargeCallId: 'c1', amountMinor: 30000 }], // L1 partiel ; L2 rien
    payments: [],
    canSeeIdentities,
    now,
  };
}

describe('assembleBoard — états dérivés', () => {
  it('L1 partiel ET en retard (deux axes), sous-note « reçu »', () => {
    const { rows } = assembleBoard(baseInput(true));
    const a1 = rows.find((r) => r.id === 'L1')!;
    expect(a1.settlement).toBe('PARTIAL');
    expect(a1.temporal).toBe('OVERDUE');
    expect(a1.daysLate).toBeGreaterThan(0);
    expect(a1.subnote).toEqual({ kind: 'received', amountMinor: 30000 });
  });

  it('L2 non réglé + en retard, sous-note villa', () => {
    const { rows } = assembleBoard(baseInput(true));
    const v1 = rows.find((r) => r.id === 'L2')!;
    expect(v1.settlement).toBe('UNSETTLED');
    expect(v1.temporal).toBe('OVERDUE');
    expect(v1.subnote).toEqual({ kind: 'villa' });
  });

  it('occupation : locataire / propriétaire / vacant', () => {
    const { rows } = assembleBoard(baseInput(true));
    expect(rows.find((r) => r.id === 'L1')!.occupancy).toBe('tenant');
    expect(rows.find((r) => r.id === 'L2')!.occupancy).toBe('owner');
    expect(rows.find((r) => r.id === 'L3')!.occupancy).toBe('vacant');
  });

  it('délégation de charges signalée sur le locataire', () => {
    const { rows } = assembleBoard(baseInput(true));
    expect(rows.find((r) => r.id === 'L1')!.tenant?.delegated).toBe(true);
  });

  it('indicateurs justes', () => {
    const { kpis } = assembleBoard(baseInput(true));
    expect(kpis).toMatchObject({ total: 3, apartments: 2, villas: 1, ownersAbroad: 1, overdue: 2 });
  });
});

describe('étanchéité — un locataire n’obtient AUCUNE identité de propriétaire', () => {
  it('sans droit d’identités : owner/tenant nuls, mais les états restent dérivés', () => {
    const { rows, kpis } = assembleBoard(baseInput(false));
    const a1 = rows.find((r) => r.id === 'L1')!;
    expect(a1.owner).toBeNull();
    expect(a1.tenant).toBeNull();
    expect(a1.ownerAbroad).toBe(false);
    // aucune fuite d'identité, mais l'état financier (non PII) reste calculé
    expect(a1.settlement).toBe('PARTIAL');
    expect(kpis.ownersAbroad).toBe(0);
  });

  it('avec droit d’identités : le propriétaire à l’étranger apparaît', () => {
    const { rows } = assembleBoard(baseInput(true));
    const a1 = rows.find((r) => r.id === 'L1')!;
    expect(a1.owner).toMatchObject({ name: 'Sara Tahiri', abroad: true, country: 'France' });
  });
});
