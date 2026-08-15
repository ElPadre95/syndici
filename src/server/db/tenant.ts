/**
 * Barrière d'isolation multi-tenant (decision D16). La `Residence` est l'unité
 * d'isolation. Le prototype confiait tout à la RLS Supabase — ici la barrière est
 * CÔTÉ SERVEUR et structurelle :
 *
 *   1. Le client Prisma « brut » n'est jamais exporté. Le SEUL accès aux modèles
 *      scopés passe par `forResidence(residenceId)`, qui injecte `residenceId` dans
 *      chaque requête (where sur les lectures, data sur les écritures) et REFUSE
 *      toute tentative de viser une autre résidence (`TenantScopeError`).
 *   2. `TENANT_MODELS` liste tous les modèles portant `residenceId`. Un test méta
 *      vérifie qu'AUCUN modèle scopé n'est oublié (couverture exhaustive).
 *   3. Cas multi-résidences (propriétaire MRE, employé de cabinet) : on ne fait
 *      jamais de requête globale. On résout d'abord l'ensemble des résidences
 *      autorisées (`resolveResidences*`, seuls points de lecture transverses,
 *      restreints à `select residenceId`), puis on interroge chaque résidence via
 *      `forResidence(id)`.
 *
 * Limite assumée : ce garde couvre les opérations de premier niveau. Les écritures
 * imbriquées (nested writes) doivent partir d'un modèle déjà scopé.
 */
import { getBaseClient } from './client';

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeError';
  }
}

/** Tous les modèles portant `residenceId` (l'unité d'isolation). PascalCase = nom Prisma. */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  'Mandate',
  'Lot',
  'LotAttachment',
  'ChargeCall',
  'Payment',
  'PaymentAllocation',
  'NumberSequence',
  'Receipt',
  'LateFee',
  'SettlementAccount',
  'ExpenseCategory',
  'Expense',
  'SupplierContract',
  'Incident',
  'IncidentUpdate',
  'Announcement',
  'Vote',
  'VoteOption',
  'Ballot',
  'FileAsset',
  'Document',
  'Conversation',
  'Message',
  'ReminderRule',
  'Reminder',
  'InvitationCode',
  'AuditLog',
]);

// Opérations dont le scope s'injecte dans `where`.
const WHERE_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'updateMany',
  'deleteMany',
  'aggregate',
  'groupBy',
  'count',
  'update',
  'delete',
]);
// Opérations dont le scope s'injecte dans `data`.
const DATA_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);
// findUnique(OrThrow) : le scope n'est pas injectable dans un where unique ;
// le résultat est vérifié après coup (voir forResidence).
const UNIQUE_OPS = new Set(['findUnique', 'findUniqueOrThrow']);

type Args = Record<string, unknown>;

function injectWhereScope(where: unknown, residenceId: string): Args {
  const w = (where ?? {}) as Args;
  if ('residenceId' in w && w.residenceId !== residenceId) {
    throw new TenantScopeError(
      `Cross-tenant query blocked: where.residenceId=${String(w.residenceId)} != scope ${residenceId}.`,
    );
  }
  return { ...w, residenceId };
}

function injectDataScope(data: unknown, residenceId: string): unknown {
  if (Array.isArray(data)) return data.map((row) => injectDataScope(row, residenceId));
  const d = (data ?? {}) as Args;
  if ('residenceId' in d && d.residenceId !== residenceId) {
    throw new TenantScopeError(
      `Cross-tenant write blocked: data.residenceId=${String(d.residenceId)} != scope ${residenceId}.`,
    );
  }
  return { ...d, residenceId };
}

/**
 * Applique le scope résidence à des arguments Prisma. PURE et testable.
 * Renvoie de nouveaux arguments ; lève `TenantScopeError` sur toute tentative
 * de viser une autre résidence.
 */
export function enforceTenantScope(
  operation: string,
  args: Args | undefined,
  residenceId: string,
): Args {
  const a: Args = { ...(args ?? {}) };
  if (DATA_OPS.has(operation)) {
    a.data = injectDataScope(a.data, residenceId);
    return a;
  }
  if (operation === 'upsert') {
    a.where = injectWhereScope(a.where, residenceId);
    a.create = injectDataScope(a.create, residenceId);
    a.update = a.update ?? {}; // update ne change jamais residenceId
    return a;
  }
  if (WHERE_OPS.has(operation)) {
    a.where = injectWhereScope(a.where, residenceId);
    return a;
  }
  if (UNIQUE_OPS.has(operation)) {
    // scope non injectable ; vérification post-requête dans forResidence.
    return a;
  }
  // Opération inconnue sur un modèle scopé : refus par défaut (fail-closed).
  throw new TenantScopeError(`Unsupported operation "${operation}" on a tenant model.`);
}

/**
 * Client Prisma lié à une résidence : toutes les opérations sur les modèles scopés
 * sont automatiquement contraintes à `residenceId`. Seul point d'accès aux données tenant.
 */
export function forResidence(residenceId: string) {
  if (!residenceId) throw new TenantScopeError('forResidence requires a residenceId.');
  return getBaseClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }
          const scoped = enforceTenantScope(operation, args as Args, residenceId);
          const result = await query(scoped);
          // findUnique(OrThrow) : vérifier que la ligne appartient bien à la résidence.
          if (UNIQUE_OPS.has(operation) && result && typeof result === 'object') {
            const rid = (result as Args).residenceId;
            if (rid !== undefined && rid !== residenceId) {
              if (operation === 'findUniqueOrThrow') {
                throw new TenantScopeError('Row belongs to another residence.');
              }
              return null;
            }
          }
          return result;
        },
      },
    },
  });
}

// ─── Résolution des résidences accessibles : SEULS points de lecture transverses. ───

/** Résidences gérées par une organisation (mandats actifs). */
export async function resolveResidencesForOrganization(organizationId: string): Promise<string[]> {
  const rows = await getBaseClient().mandate.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: { residenceId: true },
  });
  return [...new Set(rows.map((r) => r.residenceId))];
}

/** Résidences accessibles à un employé de cabinet (via ses organisations). */
export async function resolveResidencesForStaff(personId: string): Promise<string[]> {
  const memberships = await getBaseClient().membership.findMany({
    where: { personId, status: 'ACTIVE' },
    select: { organizationId: true },
  });
  const orgIds = memberships.map((m) => m.organizationId);
  if (orgIds.length === 0) return [];
  const mandates = await getBaseClient().mandate.findMany({
    where: { organizationId: { in: orgIds }, status: 'ACTIVE' },
    select: { residenceId: true },
  });
  return [...new Set(mandates.map((m) => m.residenceId))];
}

/** Résidences où une personne détient un lot (cas du propriétaire MRE multi-résidences). */
export async function resolveResidencesForOwner(personId: string): Promise<string[]> {
  const rows = await getBaseClient().lotAttachment.findMany({
    where: { personId, role: 'OWNER', endDate: null },
    select: { residenceId: true },
  });
  return [...new Set(rows.map((r) => r.residenceId))];
}
