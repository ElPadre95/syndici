import { describe, it, expect } from 'vitest';
import {
  ownerAt,
  occupantAt,
  chargePayerAt,
  hasRoleOverlap,
  type AttachmentPeriod,
} from './history';

// Lot B3 : owner O1 (2024→2025-02), then owner O2 (2025-03→now).
// Tenant T1 occupies 2025-01→2025-06.
const atts: AttachmentPeriod[] = [
  {
    role: 'OWNER',
    personId: 'O1',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-02-28'),
    isChargePayer: true,
  },
  {
    role: 'OWNER',
    personId: 'O2',
    startDate: new Date('2025-03-01'),
    endDate: null,
    isChargePayer: true,
  },
  {
    role: 'TENANT',
    personId: 'T1',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-06-30'),
  },
];

describe('historized attachments — who owned/occupied a lot at a date', () => {
  it('resolves the owner at a past date', () => {
    expect(ownerAt(atts, new Date('2025-03-15'))?.personId).toBe('O2');
    expect(ownerAt(atts, new Date('2024-06-01'))?.personId).toBe('O1');
  });

  it('resolves the occupant: tenant if present, else owner', () => {
    expect(occupantAt(atts, new Date('2025-03-15'))?.personId).toBe('T1'); // tenant occupies
    expect(occupantAt(atts, new Date('2025-08-01'))?.personId).toBe('O2'); // tenant gone -> owner-occupant
  });

  it('resolves the active charge payer', () => {
    expect(chargePayerAt(atts, new Date('2025-04-01'))?.personId).toBe('O2');
  });

  it('detects no overlap in a coherent history', () => {
    expect(hasRoleOverlap(atts)).toBe(false);
  });

  it('detects an incoherent overlap of two same-role periods', () => {
    const bad: AttachmentPeriod[] = [
      {
        role: 'OWNER',
        personId: 'A',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-06-01'),
      },
      { role: 'OWNER', personId: 'B', startDate: new Date('2025-01-01'), endDate: null },
    ];
    expect(hasRoleOverlap(bad)).toBe(true);
  });
});
