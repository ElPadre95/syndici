/**
 * Fiche minimale d'un lot (A4 → complète en A5) : identité + occupants. Les
 * identités passent par person-access (jamais d'accès direct à Person).
 */
import { forResidence } from '@/server/db/tenant';
import { prismaExecutor } from '@/server/db/sql';
import { getAccessiblePerson } from '@/server/auth/person-access';
import type { ActiveContext } from '@/server/auth/context';
import { getLot, type LotRow } from './data';

export interface FicheOccupant {
  name: string;
  abroad: boolean;
  country: string | null;
  delegated: boolean;
}

export interface LotFiche {
  lot: LotRow;
  owner: FicheOccupant | null;
  tenant: FicheOccupant | null;
}

function isAbroad(nationality: string | null): boolean {
  if (!nationality) return false;
  const n = nationality.trim().toLowerCase();
  return n !== '' && n !== 'maroc' && n !== 'ma' && n !== 'morocco';
}

export async function getLotFiche(ctx: ActiveContext, lotId: string): Promise<LotFiche | null> {
  const lot = await getLot(ctx.residenceId, lotId);
  if (!lot) return null;

  const attachments = await forResidence(ctx.residenceId).lotAttachment.findMany({
    where: { lotId, endDate: null },
    select: { personId: true, role: true, isChargePayer: true },
  });

  const exec = prismaExecutor();
  let owner: FicheOccupant | null = null;
  let tenant: FicheOccupant | null = null;
  for (const a of attachments) {
    const person = await getAccessiblePerson(exec, ctx, a.personId);
    if (!person) continue;
    const occ: FicheOccupant = {
      name: `${person.firstName} ${person.lastName}`.trim(),
      abroad: isAbroad(person.nationality),
      country: person.nationality,
      delegated: a.isChargePayer,
    };
    if (a.role === 'OWNER') owner = occ;
    else tenant = occ;
  }

  return { lot, owner, tenant };
}
