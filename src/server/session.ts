/**
 * Contexte de session côté serveur — le point d'entrée que TOUS les écrans
 * connectés utilisent (§4). Compose l'identité (`auth()` → personId), la liste
 * FRAÎCHE des résidences accessibles (jamais le JWT, qui peut être périmé après une
 * création), la résidence active et le rôle effectif sur cette résidence.
 *
 * SÉCURITÉ : le cookie de résidence active est traité comme une ENTRÉE NON FIABLE,
 * au même titre qu'un paramètre d'URL forgé. La seule autorité sur « quelles
 * résidences cette personne peut activer » est `listAccessibleResidences`
 * (mandat ACTIF non expiré pour le staff, rattachement de lot courant pour un
 * résident). Un cookie hors de cet ensemble est ignoré, sans erreur.
 */
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { prismaExecutor } from '@/server/db/sql';
import { getResidenceRole, listAccessibleResidences } from '@/server/auth/context';
import { resolveActiveResidenceId } from '@/server/auth/active-residence';
import { listResidencesForPerson, type ResidenceListItem } from '@/server/residences/data';
import type { AppRole } from '@/server/auth/permissions';

export const ACTIVE_RESIDENCE_COOKIE = 'syndici.activeResidence';

export { resolveActiveResidenceId };

export interface SessionContext {
  personId: string;
  userLabel: string | null;
  /** Résidences que la personne peut activer, nommées (pour le sélecteur d'en-tête). */
  residences: ResidenceListItem[];
  activeId: string | null;
  role: AppRole | null;
  /** A-t-elle un accès STAFF (syndic/gestionnaire) à au moins une résidence ? Sinon : résident. */
  isStaff: boolean;
}

/** Renvoie le contexte, ou `null` si non authentifié (le middleware garde déjà les routes). */
export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await auth();
  const personId = session?.user?.personId;
  if (!personId) return null;

  const exec = prismaExecutor();
  const accessibleIds = await listAccessibleResidences(exec, personId);
  // Liste d'affichage (staff) restreinte aux résidences réellement accessibles.
  const managed = await listResidencesForPerson(personId);
  const residences = managed.filter((r) => accessibleIds.includes(r.id));

  const store = await cookies();
  const activeId = resolveActiveResidenceId(
    accessibleIds,
    store.get(ACTIVE_RESIDENCE_COOKIE)?.value,
  );
  const role = activeId ? await getResidenceRole(exec, personId, activeId) : null;
  const userLabel = session.user?.name ?? session.user?.email ?? null;
  // Staff = au moins une résidence gérée (mandat actif). Sinon, la personne est un
  // résident : l'accueil et la navigation lui présentent une vue réduite (A7 §1).
  const isStaff = residences.length > 0;

  return { personId, userLabel, residences, activeId, role, isStaff };
}
