/**
 * Génération de références de lots (A3) — PURE et testable.
 *
 * Le syndic choisit le schéma plutôt que de subir le nôtre :
 *   - `continuous` : préfixe (éventuel) + numéro continu (1, 2, 3… ou « LOT-1 »…) ;
 *   - `floor` : une lettre par étage/bloc + numéro d'unité (A1, A2, B1, B2…).
 * En mode mixte, on combine plusieurs groupes (p. ex. 18 appartements + 6 villas)
 * avec des préfixes distincts.
 *
 * `planGeneration` compare l'ensemble généré aux références existantes : rien n'est
 * écrasé, les conflits sont signalés, les doublons internes détectés. Idempotent :
 * relancer avec les mêmes références ne produit aucune création.
 */
export type LotType = 'APPARTEMENT' | 'VILLA';
export type RefScheme = 'continuous' | 'floor';

export interface GroupSpec {
  type: LotType;
  count: number;
  scheme: RefScheme;
  prefix: string;
  /** Nombre d'étages/blocs pour le schéma `floor` (>= 1). */
  floors?: number;
  /** Premier numéro pour le schéma `continuous` (défaut 1). */
  start?: number;
}

export interface GeneratedLot {
  reference: string;
  type: LotType;
  floor: string | null;
}

const MAX_LOTS_PER_GENERATION = 1000; // garde-fou

/** Génère les références d'un groupe. Lève sur des paramètres incohérents. */
export function generateGroup(group: GroupSpec): GeneratedLot[] {
  const count = group.count;
  if (!Number.isInteger(count) || count < 0) throw new RangeError('count invalide');
  if (count > MAX_LOTS_PER_GENERATION) throw new RangeError('count trop grand');
  const prefix = group.prefix ?? '';
  const out: GeneratedLot[] = [];

  if (group.scheme === 'continuous') {
    const start = group.start ?? 1;
    for (let i = 0; i < count; i++) {
      out.push({ reference: `${prefix}${start + i}`, type: group.type, floor: null });
    }
    return out;
  }

  // scheme === 'floor'
  const floors = group.floors ?? 1;
  if (!Number.isInteger(floors) || floors < 1) throw new RangeError('floors invalide');
  const perFloor = Math.ceil(count / floors);
  let made = 0;
  for (let f = 0; f < floors && made < count; f++) {
    const letter = floorLabel(f);
    for (let u = 1; u <= perFloor && made < count; u++) {
      out.push({ reference: `${prefix}${letter}${u}`, type: group.type, floor: letter });
      made++;
    }
  }
  return out;
}

/** A, B, …, Z, AA, AB, … pour les étages/blocs au-delà de 26. */
function floorLabel(index: number): string {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export interface GenerationPreview {
  toCreate: GeneratedLot[];
  conflicts: string[]; // références déjà existantes (jamais écrasées)
  duplicatesWithin: string[]; // références en double DANS la demande elle-même
}

/**
 * Établit le plan de création face aux références existantes. `toCreate` ne
 * contient que des références nouvelles et uniques.
 */
export function planGeneration(
  groups: readonly GroupSpec[],
  existingRefs: readonly string[],
): GenerationPreview {
  const existing = new Set(existingRefs);
  const seen = new Set<string>();
  const duplicatesWithin = new Set<string>();
  const conflicts = new Set<string>();
  const toCreate: GeneratedLot[] = [];

  for (const group of groups) {
    for (const lot of generateGroup(group)) {
      if (seen.has(lot.reference)) {
        duplicatesWithin.add(lot.reference);
        continue;
      }
      seen.add(lot.reference);
      if (existing.has(lot.reference)) {
        conflicts.add(lot.reference);
        continue;
      }
      toCreate.push(lot);
    }
  }

  return {
    toCreate,
    conflicts: [...conflicts],
    duplicatesWithin: [...duplicatesWithin],
  };
}
