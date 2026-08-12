/**
 * Tableau des lots — l'écran principal du syndic (A4). Répond d'un coup d'œil à
 * « qui n'a pas payé, et depuis combien de temps ».
 *
 * Deux parties :
 *   - `assembleBoard` : PURE, testable. Dérive les états (règlement × temporalité
 *     par le module finance, jamais stockés), l'occupant, les indicateurs. Les
 *     identités ne sont attachées que si `canSeeIdentities` (étanchéité : un
 *     locataire n'obtient AUCUNE donnée sur le propriétaire).
 *   - `listLotsForBoard` : récupère les données en un nombre BORNÉ de requêtes
 *     (aucun N+1), à travers `forResidence` (garde tenant) et la couche
 *     person-access (seule voie vers les identités).
 */
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor } from '@/server/db/sql';
import { listResidents } from '@/server/auth/person-access';
import {
  deriveSettlementState,
  deriveTemporalState,
  daysLate as daysLateOf,
  type SettlementState,
  type TemporalState,
} from '@/server/finance/status';
import type { AppRole } from '@/server/auth/permissions';
import type { ActiveContext } from '@/server/auth/context';
import type { LotType } from './generation';

export interface BoardOccupant {
  name: string;
  abroad: boolean;
  country: string | null;
  delegated: boolean;
}

export type Occupancy = 'tenant' | 'owner' | 'vacant';

export type BoardSubnote =
  | { kind: 'paidOn'; date: string }
  | { kind: 'received'; amountMinor: number }
  | { kind: 'dueOn'; date: string }
  | { kind: 'villa' }
  | null;

export interface BoardRow {
  id: string;
  reference: string;
  type: LotType;
  floor: string | null;
  owner: BoardOccupant | null;
  tenant: BoardOccupant | null;
  occupancy: Occupancy;
  ownerAbroad: boolean;
  settlement: SettlementState | null;
  temporal: TemporalState | null;
  daysLate: number;
  amountMinor: number;
  subnote: BoardSubnote;
}

export interface BoardKpis {
  total: number;
  apartments: number;
  villas: number;
  ownersAbroad: number;
  settledThisMonth: number;
  overdue: number;
}

export interface Board {
  rows: BoardRow[];
  kpis: BoardKpis;
}

// ── Entrées de l'assembleur (types plats, testables) ────────────────────────

export type OccupancyMode = 'OWNER_OCCUPIED' | 'RENTED' | 'VACANT';

export interface RawLot {
  id: string;
  reference: string;
  type: LotType;
  floor: string | null;
  monthlyChargeMinor: number;
  occupancyMode: OccupancyMode;
}
export interface RawAttachment {
  lotId: string;
  personId: string;
  role: 'OWNER' | 'TENANT';
  isChargePayer: boolean;
}
export interface RawPerson {
  firstName: string;
  lastName: string;
  nationality: string | null;
}
export interface RawCall {
  id: string;
  lotId: string;
  amountMinor: number;
  dueDate: Date;
}
export interface RawAllocation {
  chargeCallId: string;
  amountMinor: number;
}
export interface RawPayment {
  lotId: string | null;
  receivedAt: Date;
}

export interface AssembleInput {
  lots: RawLot[];
  attachments: RawAttachment[];
  persons: Map<string, RawPerson>;
  calls: RawCall[];
  allocations: RawAllocation[];
  payments: RawPayment[];
  canSeeIdentities: boolean;
  now: Date;
}

/** Une personne réside-t-elle à l'étranger ? (nationalité renseignée et ≠ Maroc). */
function isAbroad(nationality: string | null): boolean {
  if (!nationality) return false;
  const n = nationality.trim().toLowerCase();
  return n !== '' && n !== 'maroc' && n !== 'ma' && n !== 'morocco';
}

function occupantOf(
  att: RawAttachment | undefined,
  persons: Map<string, RawPerson>,
  canSee: boolean,
): BoardOccupant | null {
  if (!att || !canSee) return null;
  const p = persons.get(att.personId);
  if (!p) return null;
  return {
    name: `${p.firstName} ${p.lastName}`.trim(),
    abroad: isAbroad(p.nationality),
    country: p.nationality,
    delegated: att.isChargePayer,
  };
}

export function assembleBoard(input: AssembleInput): Board {
  const { lots, attachments, persons, calls, allocations, payments, canSeeIdentities, now } = input;

  // Index par lot.
  const ownerAtt = new Map<string, RawAttachment>();
  const tenantAtt = new Map<string, RawAttachment>();
  for (const a of attachments) {
    if (a.role === 'OWNER') ownerAtt.set(a.lotId, a);
    else tenantAtt.set(a.lotId, a);
  }
  const callsByLot = new Map<string, RawCall[]>();
  for (const c of calls) {
    const list = callsByLot.get(c.lotId);
    if (list) list.push(c);
    else callsByLot.set(c.lotId, [c]);
  }
  const allocByCall = new Map<string, number>();
  for (const al of allocations)
    allocByCall.set(al.chargeCallId, (allocByCall.get(al.chargeCallId) ?? 0) + al.amountMinor);
  const lastPaymentByLot = new Map<string, Date>();
  for (const p of payments) {
    if (!p.lotId) continue;
    const cur = lastPaymentByLot.get(p.lotId);
    if (!cur || p.receivedAt > cur) lastPaymentByLot.set(p.lotId, p.receivedAt);
  }

  const rows: BoardRow[] = lots.map((lot) => {
    const owner = occupantOf(ownerAtt.get(lot.id), persons, canSeeIdentities);
    const tenant = occupantOf(tenantAtt.get(lot.id), persons, canSeeIdentities);
    const hasTenant = tenantAtt.has(lot.id);
    // Un locataire actif implique « loué » ; sinon on suit le mode explicite du lot
    // (occupé par le propriétaire vs résidence secondaire VIDE). Un mode RENTED
    // périmé (sans locataire actif) retombe sur « vacant ».
    const occupancy: Occupancy = hasTenant
      ? 'tenant'
      : lot.occupancyMode === 'OWNER_OCCUPIED'
        ? 'owner'
        : 'vacant';

    const ownerAtt2 = ownerAtt.get(lot.id);
    const ownerAbroad =
      canSeeIdentities && ownerAtt2
        ? isAbroad(persons.get(ownerAtt2.personId)?.nationality ?? null)
        : false;

    const lotCalls = callsByLot.get(lot.id) ?? [];
    let settlement: SettlementState | null = null;
    let temporal: TemporalState | null = null;
    let daysLate = 0;
    let subnote: BoardSubnote = null;

    if (lotCalls.length > 0) {
      const totalDue = lotCalls.reduce((s, c) => s + c.amountMinor, 0);
      const totalAlloc = lotCalls.reduce((s, c) => s + (allocByCall.get(c.id) ?? 0), 0);
      settlement = deriveSettlementState(totalDue, Math.min(totalAlloc, totalDue));

      const unsettled = lotCalls
        .filter((c) => (allocByCall.get(c.id) ?? 0) < c.amountMinor)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      const oldest = unsettled[0];
      const anchor =
        oldest ?? [...lotCalls].sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())[0]!;
      temporal = deriveTemporalState(anchor.dueDate, now);
      daysLate = oldest ? daysLateOf(oldest.dueDate, now) : 0;

      if (settlement === 'SETTLED') {
        const paid = lastPaymentByLot.get(lot.id);
        subnote = paid ? { kind: 'paidOn', date: paid.toISOString() } : null;
      } else if (totalAlloc > 0) {
        subnote = { kind: 'received', amountMinor: Math.min(totalAlloc, totalDue) };
      } else if (temporal === 'UPCOMING' && oldest) {
        subnote = { kind: 'dueOn', date: oldest.dueDate.toISOString() };
      } else if (lot.type === 'VILLA') {
        subnote = { kind: 'villa' };
      } else if (oldest) {
        subnote = { kind: 'dueOn', date: oldest.dueDate.toISOString() };
      }
    } else if (lot.type === 'VILLA') {
      subnote = { kind: 'villa' };
    }

    return {
      id: lot.id,
      reference: lot.reference,
      type: lot.type,
      floor: lot.floor,
      owner,
      tenant,
      occupancy,
      ownerAbroad,
      settlement,
      temporal,
      daysLate,
      amountMinor: lot.monthlyChargeMinor,
      subnote,
    };
  });

  const kpis: BoardKpis = {
    total: rows.length,
    apartments: rows.filter((r) => r.type === 'APPARTEMENT').length,
    villas: rows.filter((r) => r.type === 'VILLA').length,
    ownersAbroad: rows.filter((r) => r.ownerAbroad).length,
    settledThisMonth: rows.filter((r) => r.settlement === 'SETTLED').length,
    overdue: rows.filter((r) => r.temporal === 'OVERDUE' && r.settlement !== 'SETTLED').length,
  };

  return { rows, kpis };
}

function isStaff(role: AppRole): boolean {
  return role === 'SYNDIC' || role === 'GESTIONNAIRE';
}

/**
 * Récupère le tableau pour la résidence active. Requêtes BORNÉES (indépendantes du
 * nombre de lots) : lots, rattachements, appels, allocations, paiements (via la
 * garde tenant) + annuaire des personnes (via person-access, staff uniquement).
 */
export async function listLotsForBoard(ctx: ActiveContext, now: Date = new Date()): Promise<Board> {
  const scoped = forResidence(ctx.residenceId);
  const canSee = isStaff(ctx.role);

  const [lots, attachments, calls, allocations, payments] = await Promise.all([
    scoped.lot.findMany({
      where: { archivedAt: null },
      orderBy: { reference: 'asc' },
      select: {
        id: true,
        reference: true,
        type: true,
        floor: true,
        monthlyChargeMinor: true,
        occupancyMode: true,
      },
    }),
    scoped.lotAttachment.findMany({
      where: { endDate: null },
      select: { lotId: true, personId: true, role: true, isChargePayer: true },
    }),
    scoped.chargeCall.findMany({
      where: { voidedAt: null },
      select: { id: true, lotId: true, amountMinor: true, dueDate: true },
    }),
    scoped.paymentAllocation.findMany({ select: { chargeCallId: true, amountMinor: true } }),
    scoped.payment.findMany({ select: { lotId: true, receivedAt: true } }),
  ]);

  const persons = new Map<string, RawPerson>();
  if (canSee) {
    for (const p of await listResidents(prismaExecutor(), ctx)) {
      persons.set(p.id, {
        firstName: p.firstName,
        lastName: p.lastName,
        nationality: p.nationality,
      });
    }
  }

  return assembleBoard({
    lots: lots.map((l) => ({
      ...l,
      type: l.type as LotType,
      occupancyMode: l.occupancyMode as OccupancyMode,
    })),
    attachments: attachments.map((a) => ({ ...a, role: a.role as 'OWNER' | 'TENANT' })),
    persons,
    calls,
    allocations,
    payments,
    canSeeIdentities: canSee,
    now,
  });
}
