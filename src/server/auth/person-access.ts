/**
 * COUCHE D'ACCÈS AUX PERSONNES — LE POINT CRITIQUE (§2).
 *
 * `Person` porte des données personnelles (nom, e-mail, téléphone, nationalité) et
 * n'est PAS derrière la garde tenant (`forResidence`), parce qu'un propriétaire MRE
 * existe dans plusieurs résidences à la fois : il n'a pas de `residenceId` propre.
 *
 * Conséquence : ce fichier est le SEUL de tout `src/` (hors tests) autorisé à lire
 * ou écrire le modèle des personnes. Un test méta (person-access.meta.test.ts) le
 * prouve : aucun autre module ne référence la table ni l'accesseur Prisma. Toute
 * lecture passe par une fonction d'ici, qui n'accepte de renvoyer une personne que
 * si elle est ATTEIGNABLE depuis le contexte actif par un chemin autorisé
 * (rattachement de lot scopé, ou appartenance à l'organisation mandataire).
 *
 * Invariant de fuite : un LOCATAIRE (ou un PROPRIÉTAIRE) n'obtient AUCUNE donnée sur
 * une autre personne que lui-même — donc rien sur le propriétaire de son propre lot.
 */
import type { SqlExecutor } from '@/server/db/sql';
import type { ActiveContext } from './context';

/** Vue publique d'une personne — jamais `authUserId`, jamais de secret. */
export interface PersonView {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  preferredLocale: string;
}

const PERSON_COLUMNS = 'id, "firstName", "lastName", email, phone, nationality, "preferredLocale"';

export class PersonAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersonAccessError';
  }
}

/** Seuls SYNDIC/GESTIONNAIRE peuvent voir des personnes tierces (annuaire). */
function isStaff(role: ActiveContext['role']): boolean {
  return role === 'SYNDIC' || role === 'GESTIONNAIRE';
}

/**
 * Une personne est-elle atteignable depuis un contexte staff ? Oui si, dans la
 * résidence active, elle est rattachée à un lot, OU membre de l'organisation qui
 * détient le mandat actif de cette résidence. Le staff ne « voit » donc jamais
 * au-delà des résidences qu'il gère effectivement.
 */
async function reachableByStaff(
  exec: SqlExecutor,
  residenceId: string,
  targetPersonId: string,
): Promise<boolean> {
  const rows = await exec.query<{ ok: number }>(
    `SELECT 1 AS ok
       FROM "LotAttachment"
      WHERE "personId" = $1 AND "residenceId" = $2
      UNION
     SELECT 1 AS ok
       FROM "Membership" mem
       JOIN "Mandate" md ON md."organizationId" = mem."organizationId"
      WHERE mem."personId" = $1
        AND md."residenceId" = $2
        AND md.status = 'ACTIVE'
        AND (md."endDate" IS NULL OR md."endDate" >= CURRENT_DATE)
      LIMIT 1`,
    [targetPersonId, residenceId],
  );
  return rows.length > 0;
}

/**
 * Lit une personne SI et SEULEMENT SI le contexte y donne droit :
 *   - toujours soi-même ;
 *   - sinon, staff uniquement, et seulement si la cible est atteignable.
 * Renvoie `null` (pas d'erreur) quand l'accès est refusé : l'appelant ne peut pas
 * distinguer « n'existe pas » de « pas le droit », donc aucune fuite d'existence.
 */
export async function getAccessiblePerson(
  exec: SqlExecutor,
  ctx: ActiveContext,
  targetPersonId: string,
): Promise<PersonView | null> {
  if (targetPersonId !== ctx.personId) {
    if (!isStaff(ctx.role)) return null;
    if (!(await reachableByStaff(exec, ctx.residenceId, targetPersonId))) return null;
  }
  const rows = await exec.query<PersonView>(
    `SELECT ${PERSON_COLUMNS} FROM "Person" WHERE id = $1 LIMIT 1`,
    [targetPersonId],
  );
  return rows[0] ?? null;
}

/** Annuaire des personnes rattachées à la résidence active — staff uniquement. */
export async function listResidents(exec: SqlExecutor, ctx: ActiveContext): Promise<PersonView[]> {
  if (!isStaff(ctx.role)) throw new PersonAccessError('resident.list interdit pour ce rôle');
  return exec.query<PersonView>(
    `SELECT DISTINCT ${PERSON_COLUMNS.split(', ')
      .map((c) => `p.${c}`)
      .join(', ')}
       FROM "Person" p
       JOIN "LotAttachment" la ON la."personId" = p.id
      WHERE la."residenceId" = $1`,
    [ctx.residenceId],
  );
}

/** Données d'une nouvelle personne (créée par le staff lors d'un rattachement). */
export interface CreatePersonInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  preferredLocale: string; // 'fr' | 'ar'
}

/** Crée une personne — staff uniquement. Renvoie son id. */
export async function createPerson(
  exec: SqlExecutor,
  ctx: ActiveContext,
  input: CreatePersonInput,
): Promise<string> {
  if (!isStaff(ctx.role))
    throw new PersonAccessError('création de personne interdite pour ce rôle');
  const rows = await exec.query<{ id: string }>(
    `INSERT INTO "Person"(id, "firstName", "lastName", email, phone, nationality, "preferredLocale", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::"Locale", now())
     RETURNING id`,
    [
      input.firstName,
      input.lastName,
      input.email ?? null,
      input.phone ?? null,
      input.nationality ?? null,
      input.preferredLocale,
    ],
  );
  return rows[0]!.id;
}

/**
 * Dédoublonnage d'import (A7) : id d'une personne DÉJÀ rattachée à la résidence
 * active, retrouvée par e-mail exact. Reste dans la couche d'accès aux personnes
 * (seule autorisée à lire le modèle Person). Staff uniquement, bornée à la résidence
 * du contexte — aucune fuite hors périmètre.
 */
export async function findAttachedPersonIdByEmail(
  exec: SqlExecutor,
  ctx: ActiveContext,
  email: string,
): Promise<string | null> {
  if (!isStaff(ctx.role)) throw new PersonAccessError('recherche de personne interdite');
  const rows = await exec.query<{ id: string }>(
    `SELECT p.id
       FROM "Person" p
       JOIN "LotAttachment" la ON la."personId" = p.id
      WHERE la."residenceId" = $1 AND lower(p.email) = lower($2)
      LIMIT 1`,
    [ctx.residenceId, email],
  );
  return rows[0]?.id ?? null;
}

/**
 * Recherche de personnes DÉJÀ CONNUES du syndic, pour éviter les doublons (cas MRE :
 * un propriétaire qui possède des lots dans plusieurs résidences gérées). Bornée aux
 * résidences que le syndic gère (`residenceIds`) — jamais une fuite vers d'autres
 * cabinets. Staff uniquement.
 */
export async function searchPersons(
  exec: SqlExecutor,
  ctx: ActiveContext,
  query: string,
  residenceIds: readonly string[],
): Promise<PersonView[]> {
  if (!isStaff(ctx.role)) throw new PersonAccessError('recherche de personnes interdite');
  const q = query.trim().toLowerCase();
  if (q === '' || residenceIds.length === 0) return [];
  return exec.query<PersonView>(
    `SELECT DISTINCT ${PERSON_COLUMNS.split(', ')
      .map((c) => `p.${c}`)
      .join(', ')}
       FROM "Person" p
       JOIN "LotAttachment" la ON la."personId" = p.id
      WHERE la."residenceId" = ANY(string_to_array($2, ','))
        AND (lower(p."firstName" || ' ' || p."lastName") LIKE $1 OR lower(coalesce(p.email, '')) LIKE $1)
      LIMIT 10`,
    [`%${q}%`, residenceIds.join(',')],
  );
}

/**
 * Résout la Person métier liée à un compte d'authentification. Point d'entrée
 * unique pour transformer une session (User.id) en identité métier (Person.id).
 */
export async function resolvePersonIdForUser(
  exec: SqlExecutor,
  authUserId: string,
): Promise<string | null> {
  const rows = await exec.query<{ id: string }>(
    `SELECT id FROM "Person" WHERE "authUserId" = $1 LIMIT 1`,
    [authUserId],
  );
  return rows[0]?.id ?? null;
}

/**
 * Rattache un compte à une personne — UNE seule fois, IRRÉVERSIBLEMENT (pas de
 * repli e-mail : c'est la faille de reprise de compte du prototype qui est fermée
 * ici). L'UPDATE conditionnel `authUserId IS NULL` garantit qu'une personne déjà
 * rattachée ne peut jamais être « re-rattachée » à un autre compte. Renvoie `false`
 * si la personne est déjà liée. À appeler exclusivement depuis le parcours invitation.
 */
export async function linkAuthAccount(
  exec: SqlExecutor,
  personId: string,
  authUserId: string,
): Promise<boolean> {
  const rows = await exec.query<{ id: string }>(
    `UPDATE "Person" SET "authUserId" = $1, "updatedAt" = now()
      WHERE id = $2 AND "authUserId" IS NULL
      RETURNING id`,
    [authUserId, personId],
  );
  return rows.length > 0;
}
