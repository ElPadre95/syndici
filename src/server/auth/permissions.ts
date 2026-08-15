/**
 * Matrice d'autorisations — SOURCE UNIQUE DE VÉRITÉ (§3).
 *
 * Aucun composant, aucune route ne doit coder « en dur » un test de rôle
 * (`if (role === 'SYNDIC')`). Tout passe par `can(role, action)`. Cette fonction
 * est PURE (aucune dépendance DB) : la portée par résidence (mandat actif, lot
 * atteignable) est appliquée séparément par `context.ts` et `person-access.ts`.
 *
 * Rôles applicatifs (distincts des rôles d'organisation OrgRole) :
 *   - SYNDIC        : responsable du cabinet, tous droits sur les résidences sous
 *                     mandat actif de son organisation.
 *   - GESTIONNAIRE  : idem SYNDIC, MOINS les réglages de résidence, les
 *                     suppressions et la gestion des membres.
 *   - PROPRIETAIRE  : ses lots, ses charges/paiements, dépenses visibles, votes,
 *                     ses documents, signalement d'incident.
 *   - LOCATAIRE     : son lot, signalement d'incident, actualités, ses documents.
 *                     PAS les dépenses, PAS les votes, PAS l'identité du propriétaire.
 */
export type AppRole = 'SYNDIC' | 'GESTIONNAIRE' | 'PROPRIETAIRE' | 'LOCATAIRE';

/**
 * Actions autorisables. Nom = `domaine.verbe`. Toute nouvelle capacité doit être
 * ajoutée ici et à la matrice ci-dessous — jamais testée ailleurs par un `if` de rôle.
 */
export type Permission =
  // Résidence & configuration
  | 'residence.view'
  | 'residence.settings' // réglages financiers, automatisations
  | 'residence.delete'
  | 'member.manage' // gestion des membres du cabinet
  // Lots & personnes
  | 'lot.view.all' // tous les lots de la résidence
  | 'lot.view.own' // ses propres lots
  | 'lot.manage' // créer / générer / modifier / archiver des lots
  | 'lot.delete' // supprimer physiquement un lot vierge (jamais s'il a un historique)
  | 'owner.identity.view' // voir l'identité d'un propriétaire (PII sensible)
  | 'resident.list' // lister les résidents (annuaire cabinet)
  | 'invitation.manage' // émettre / révoquer des codes d'invitation
  // Finance
  | 'charge.view.all'
  | 'charge.view.own'
  | 'charge.manage' // générer des campagnes d'appels de charges
  | 'payment.record' // enregistrer un paiement (immuable)
  | 'payment.view.all' // vue globale des paiements de la résidence (staff)
  | 'payment.view.own'
  | 'payment.pay.own' // régler soi-même ses charges (paiement en ligne) — propriétaire
  | 'receipt.issue'
  | 'expense.view' // dépenses & justificatifs de la copropriété
  | 'expense.manage'
  | 'contract.view' // contrats fournisseurs & échéances
  | 'contract.manage'
  | 'reminder.manage' // relances impayés
  // Vie de la copropriété
  | 'incident.report'
  | 'incident.manage'
  | 'vote.view'
  | 'vote.cast'
  | 'vote.manage'
  | 'announcement.view'
  | 'announcement.manage'
  | 'document.view.own'
  | 'document.deposit.own' // déposer/renommer/retirer SES propres documents (résident)
  | 'document.manage';

/** Droits communs à tous les rôles connectés (aucun n'implique de PII tierce). */
const COMMON: readonly Permission[] = [
  'residence.view',
  'incident.report',
  'announcement.view',
  'document.view.own',
  'document.deposit.own', // tout résident dépose SES propres documents (le locataire aussi, plus tard)
];

/**
 * Matrice. On liste les droits ACCORDÉS par rôle ; tout ce qui n'est pas listé
 * est refusé par défaut (deny-by-default).
 */
const MATRIX: Record<AppRole, ReadonlySet<Permission>> = {
  SYNDIC: new Set<Permission>([
    ...COMMON,
    'residence.settings',
    'residence.delete',
    'member.manage',
    'lot.view.all',
    'lot.manage',
    'lot.delete',
    'owner.identity.view',
    'resident.list',
    'invitation.manage',
    'charge.view.all',
    'charge.manage',
    'payment.record',
    'payment.view.all',
    'receipt.issue',
    'expense.view',
    'expense.manage',
    'contract.view',
    'contract.manage',
    'reminder.manage',
    'incident.manage',
    'vote.view',
    'vote.manage',
    'announcement.manage',
    'document.manage',
  ]),
  // GESTIONNAIRE = SYNDIC sans réglages résidence, suppressions, gestion des membres.
  GESTIONNAIRE: new Set<Permission>([
    ...COMMON,
    'lot.view.all',
    'lot.manage',
    'owner.identity.view',
    'resident.list',
    'invitation.manage',
    'charge.view.all',
    'charge.manage',
    'payment.record',
    'payment.view.all',
    'receipt.issue',
    'expense.view',
    'expense.manage',
    'contract.view',
    'contract.manage',
    'reminder.manage',
    'incident.manage',
    'vote.view',
    'vote.manage',
    'announcement.manage',
    'document.manage',
  ]),
  PROPRIETAIRE: new Set<Permission>([
    ...COMMON,
    'lot.view.own',
    'charge.view.own',
    'payment.view.own',
    'payment.pay.own', // régler ses charges en ligne (jamais le staff)
    'expense.view', // le propriétaire voit les dépenses de la copropriété
    'vote.view',
    'vote.cast',
  ]),
  // LOCATAIRE : son lot, incidents, actualités, ses documents. NI dépenses, NI votes,
  // NI identité du propriétaire.
  LOCATAIRE: new Set<Permission>([...COMMON, 'lot.view.own', 'charge.view.own']),
};

/** Le rôle `role` a-t-il le droit `permission` ? Fonction pure, deny par défaut. */
export function can(role: AppRole, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}

/** Liste (triée) des droits d'un rôle — utile pour l'UI et les tests. */
export function permissionsOf(role: AppRole): Permission[] {
  return [...MATRIX[role]].sort();
}
