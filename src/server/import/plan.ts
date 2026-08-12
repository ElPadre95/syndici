/**
 * Plan d'import (A7) — la couche de VALIDATION métier, PURE et testable (les
 * références existantes sont passées en argument). Rien ne s'écrit ici : on décide,
 * ligne par ligne, ce qui sera créé, ce qui existe déjà, et ce qui est rejeté AVEC
 * un motif compréhensible par un syndic. C'est l'aperçu montré avant confirmation.
 */
import {
  mapLocale,
  mapOccupancy,
  mapUnitType,
  normalizeEmail,
  parseBool,
  parseIntLoose,
  parseMoneyToCentimes,
  splitName,
} from './normalize';
import type { ParsedSheet } from './parse';

export type RejectReason =
  | 'missing_reference'
  | 'duplicate_in_file'
  | 'tenant_without_owner'
  | 'unreadable_amount'
  | 'invalid_quote_part'
  | 'malformed_email'
  | 'unknown_unit_type';

export type RowStatus = 'create' | 'exists' | 'reject';

export interface PersonDraft {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  locale: 'fr' | 'ar';
}

export interface LotDraft {
  reference: string;
  type: 'APPARTEMENT' | 'VILLA';
  floor: string | null;
  surfaceM2: number | null;
  quotePart: number | null; // null = à répartir sur 1000 (colonne absente)
  monthlyChargeMinor: number;
  occupancy: 'OWNER_OCCUPIED' | 'RENTED' | 'VACANT';
}

export interface PlannedRow {
  rowNumber: number;
  reference: string;
  status: RowStatus;
  reason?: RejectReason;
  ownerName?: string; // pour l'aperçu (jamais d'e-mail affiché en clair)
  lot?: LotDraft;
  owner?: PersonDraft | null;
  tenant?: PersonDraft | null;
  delegated?: boolean;
}

export interface ImportPlan {
  rows: PlannedRow[];
  counts: { total: number; create: number; exists: number; reject: number };
  recognizedColumns: string[];
  hasQuotePartColumn: boolean;
}

function personDraft(
  name: string,
  email: string | null,
  phone: string | undefined,
  country: string | undefined,
  locale: string | undefined,
): PersonDraft {
  const { firstName, lastName } = splitName(name);
  return {
    firstName,
    lastName,
    email,
    phone: phone && phone !== '' ? phone : null,
    nationality: country && country !== '' ? country : null,
    locale: mapLocale(locale ?? ''),
  };
}

/** Construit le plan à partir des lignes brutes et des références DÉJÀ présentes. */
export function planImport(sheet: ParsedSheet, existingRefs: ReadonlySet<string>): ImportPlan {
  const seen = new Set<string>();
  const rows: PlannedRow[] = [];

  for (const raw of sheet.rows) {
    const v = raw.values;
    const reference = (v.reference ?? '').trim();
    const base = { rowNumber: raw.rowNumber, reference };

    if (reference === '') {
      rows.push({ ...base, status: 'reject', reason: 'missing_reference' });
      continue;
    }
    if (seen.has(reference)) {
      rows.push({ ...base, status: 'reject', reason: 'duplicate_in_file' });
      continue;
    }
    seen.add(reference);

    if (existingRefs.has(reference)) {
      rows.push({ ...base, status: 'exists' });
      continue;
    }

    // Type d'unité.
    const type = mapUnitType(v.unitType ?? '');
    if (type === null) {
      rows.push({ ...base, status: 'reject', reason: 'unknown_unit_type' });
      continue;
    }

    // Montant des charges (facultatif ; illisible → rejet).
    let monthlyChargeMinor = 0;
    if ((v.charge ?? '') !== '') {
      const m = parseMoneyToCentimes(v.charge!);
      if (m === null) {
        rows.push({ ...base, status: 'reject', reason: 'unreadable_amount' });
        continue;
      }
      monthlyChargeMinor = m;
    }

    // Quote-part (facultative ; présente mais invalide → rejet).
    let quotePart: number | null = null;
    if ((v.quotePart ?? '') !== '') {
      const q = parseIntLoose(v.quotePart!);
      if (q === null || q <= 0) {
        rows.push({ ...base, status: 'reject', reason: 'invalid_quote_part' });
        continue;
      }
      quotePart = q;
    }

    // E-mails (mal formés → rejet).
    const ownerEmail = normalizeEmail(v.ownerEmail ?? '');
    const tenantEmail = normalizeEmail(v.tenantEmail ?? '');
    if (!ownerEmail.ok || !tenantEmail.ok) {
      rows.push({ ...base, status: 'reject', reason: 'malformed_email' });
      continue;
    }

    const hasOwner = (v.ownerName ?? '') !== '';
    const hasTenant = (v.tenantName ?? '') !== '';
    if (hasTenant && !hasOwner) {
      rows.push({ ...base, status: 'reject', reason: 'tenant_without_owner' });
      continue;
    }

    const owner = hasOwner
      ? personDraft(v.ownerName!, ownerEmail.value, v.ownerPhone, v.ownerCountry, v.ownerLocale)
      : null;
    const tenant = hasTenant
      ? personDraft(
          v.tenantName!,
          tenantEmail.value,
          v.tenantPhone,
          v.tenantCountry,
          v.tenantLocale,
        )
      : null;
    const delegated = hasTenant ? parseBool(v.tenantDelegated ?? '') : false;

    // Un locataire actif ⇒ le lot est loué ; sinon on prend le mode déclaré, à défaut VACANT.
    const occupancy = hasTenant ? 'RENTED' : (mapOccupancy(v.occupancy ?? '') ?? 'VACANT');

    rows.push({
      ...base,
      status: 'create',
      ownerName: owner ? `${owner.firstName} ${owner.lastName}`.trim() : undefined,
      lot: {
        reference,
        type,
        floor: (v.floor ?? '') !== '' ? v.floor! : null,
        surfaceM2: parseIntLoose(v.surface ?? ''),
        quotePart,
        monthlyChargeMinor,
        occupancy,
      },
      owner,
      tenant,
      delegated,
    });
  }

  const counts = {
    total: rows.length,
    create: rows.filter((r) => r.status === 'create').length,
    exists: rows.filter((r) => r.status === 'exists').length,
    reject: rows.filter((r) => r.status === 'reject').length,
  };

  return {
    rows,
    counts,
    recognizedColumns: sheet.recognizedColumns,
    hasQuotePartColumn: sheet.recognizedColumns.includes('quotePart'),
  };
}
