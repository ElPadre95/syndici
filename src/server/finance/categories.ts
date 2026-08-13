/**
 * Catégories de dépenses par défaut selon le type de résidence (SPEC §7.3). Ce sont
 * des DONNÉES (`ExpenseCategory`, modifiables par résidence), pas un enum figé : cette
 * liste ne sert qu'à AMORCER une résidence (seed, création). Le mode mixte = union des
 * deux jeux, sans doublons (Maintenance, Assurance, Autre communs).
 */
export type ResidenceKind = 'IMMEUBLE' | 'VILLA' | 'MIXTE';

const IMMEUBLE = [
  'Nettoyage',
  'Électricité',
  'Eau commune',
  'Maintenance',
  'Ascenseur',
  'Assurance',
  'Travaux',
  'Autre',
] as const;

const VILLA = [
  'Piscine commune',
  'Jardins / espaces verts',
  'Gardiennage',
  'Éclairage public',
  'Voirie / routes',
  'Arrosage',
  'Ramassage déchets',
  'Maintenance',
  'Assurance',
  'Autre',
] as const;

export function defaultExpenseCategories(type: ResidenceKind): string[] {
  if (type === 'IMMEUBLE') return [...IMMEUBLE];
  if (type === 'VILLA') return [...VILLA];
  return [...new Set([...IMMEUBLE, ...VILLA])]; // MIXTE : union sans doublons
}
