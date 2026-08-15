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
import { cache } from 'react';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { prismaExecutor } from '@/server/db/sql';
import { resolveIdentity } from '@/server/auth/identity';
import { resolveActiveResidenceId } from '@/server/auth/active-residence';
import {
  listResidencesForPerson,
  listNamedResidences,
  type ResidenceListItem,
} from '@/server/residences/data';
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

/**
 * État d'authentification résolu, EXPLICITE (jamais silencieux) :
 *   - `anonymous` : aucune session (le middleware garde déjà les routes) ;
 *   - `stale`     : session présente mais IDENTITÉ NON RÉSOLUBLE — le `personId` du
 *                   jeton ne correspond à aucune personne (données de démo rechargées,
 *                   compte non lié). Doit être invalidée et renvoyée vers la connexion,
 *                   JAMAIS dégradée en coquille vide ;
 *   - `active`    : identité résolue, contexte utilisable (résidences éventuellement vides
 *                   pour une personne réelle sans résidence — c'est l'onboarding, pas une panne).
 */
export type AuthState =
  { status: 'anonymous' } | { status: 'stale' } | { status: 'active'; context: SessionContext };

/**
 * État d'authentification pour la requête courante. Mémoïsé (`react/cache`). Le layout
 * connecté en fait l'autorité : `stale` → connexion + message ; `active` → rendu normal.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const session = await auth();
  if (!session?.user) return { status: 'anonymous' };

  const exec = prismaExecutor();
  const store = await cookies();
  const id = await resolveIdentity(
    exec,
    session.user.personId,
    store.get(ACTIVE_RESIDENCE_COOKIE)?.value,
  );
  if (id.status === 'stale') return { status: 'stale' };

  const personId = session.user.personId!;
  // Résidences gérées (staff) — riches (lotCount, statut de mandat), restreintes aux accessibles.
  const managed = await listResidencesForPerson(personId);
  const staffAccessible = managed.filter((r) => id.accessibleIds.includes(r.id));
  // Staff = au moins une résidence gérée (mandat actif). Sinon, résident : vue réduite (A7 §1).
  const isStaff = staffAccessible.length > 0;
  // Le sélecteur d'en-tête montre TOUTES les résidences accessibles : on ajoute celles où la
  // personne n'est que résident (rattachement de lot) — le cas MRE multi-résidences.
  const managedIds = new Set(managed.map((r) => r.id));
  const residentResidences = await listNamedResidences(
    id.accessibleIds.filter((rid) => !managedIds.has(rid)),
  );
  const residences = [...staffAccessible, ...residentResidences];
  const userLabel = session.user.name ?? session.user.email ?? null;

  return {
    status: 'active',
    context: { personId, userLabel, residences, activeId: id.activeId, role: id.role, isStaff },
  };
});

/**
 * Contexte de session, ou `null` si la session n'est pas `active` (anonyme ou périmée).
 * Les écrans continuent de l'utiliser tel quel ; l'invalidation d'une session périmée
 * est portée par le layout via `getAuthState` (redirection vers la connexion).
 * Mémoïsé : le layout ET la page l'appellent, sans requêtes redondantes.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const state = await getAuthState();
  return state.status === 'active' ? state.context : null;
});
