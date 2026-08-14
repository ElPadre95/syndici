/**
 * Filtrage de l'annuaire (F2) — PUR et testable. Recherche plein-texte (nom, pays,
 * référence de lot) + filtre par rôle et par état de compte. Utilisé côté client, mais
 * gardé sans dépendance UI pour être testé isolément.
 */
export type RoleFilter = 'ALL' | 'OWNER' | 'TENANT';
export type StatusFilter = 'ALL' | 'ACTIVE' | 'PENDING' | 'NEVER';

export interface ResidentFilter {
  query: string;
  role: RoleFilter;
  status: StatusFilter;
}

export interface FilterableResident {
  fullName: string;
  country: string | null;
  lots: { reference: string }[];
  roles: ('OWNER' | 'TENANT')[];
  accountStatus: 'ACTIVE' | 'PENDING' | 'NEVER';
}

export function matchesResidentFilters(r: FilterableResident, f: ResidentFilter): boolean {
  if (f.role !== 'ALL' && !r.roles.includes(f.role)) return false;
  if (f.status !== 'ALL' && r.accountStatus !== f.status) return false;
  const q = f.query.trim().toLowerCase();
  if (q === '') return true;
  const haystack = [r.fullName, r.country ?? '', ...r.lots.map((l) => l.reference)]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}
