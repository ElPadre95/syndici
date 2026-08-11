/**
 * Contexte de session côté serveur — le point d'entrée que TOUS les écrans
 * connectés utilisent (§4). Compose l'identité (`auth()` → personId), la liste
 * FRAÎCHE des résidences accessibles (jamais le JWT, qui peut être périmé après une
 * création), la résidence active (persistée en cookie, revalidée contre les
 * résidences accessibles) et le rôle effectif sur cette résidence.
 */
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { prismaExecutor } from '@/server/db/sql';
import { getResidenceRole } from '@/server/auth/context';
import { listResidencesForPerson, type ResidenceListItem } from '@/server/residences/data';
import type { AppRole } from '@/server/auth/permissions';

export const ACTIVE_RESIDENCE_COOKIE = 'syndici.activeResidence';

export interface SessionContext {
  personId: string;
  userLabel: string | null;
  residences: ResidenceListItem[];
  activeId: string | null;
  role: AppRole | null;
}

/** Renvoie le contexte, ou `null` si non authentifié (le middleware garde déjà les routes). */
export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await auth();
  const personId = session?.user?.personId;
  if (!personId) return null;

  const residences = await listResidencesForPerson(personId);
  const store = await cookies();
  const wanted = store.get(ACTIVE_RESIDENCE_COOKIE)?.value;
  const activeId = residences.find((r) => r.id === wanted)?.id ?? residences[0]?.id ?? null;
  const role = activeId ? await getResidenceRole(prismaExecutor(), personId, activeId) : null;
  const userLabel = session.user?.name ?? session.user?.email ?? null;

  return { personId, userLabel, residences, activeId, role };
}
