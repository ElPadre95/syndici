/**
 * L'import passe par le point d'application des autorisations (A7 §3) : la garde
 * `requireImporter` exige `can(role, 'lot.manage')`. On verrouille ici la matrice :
 * un gestionnaire peut importer, un résident (propriétaire/locataire) non.
 */
import { describe, it, expect } from 'vitest';
import { can, type AppRole } from '@/server/auth/permissions';

describe('autorisation d’import (lot.manage)', () => {
  it('accordée au staff, refusée aux résidents', () => {
    expect(can('SYNDIC', 'lot.manage')).toBe(true);
    expect(can('GESTIONNAIRE', 'lot.manage')).toBe(true);
    expect(can('PROPRIETAIRE', 'lot.manage')).toBe(false);
    expect(can('LOCATAIRE', 'lot.manage')).toBe(false);
  });

  it('seuls SYNDIC et GESTIONNAIRE portent le droit', () => {
    const roles: AppRole[] = ['SYNDIC', 'GESTIONNAIRE', 'PROPRIETAIRE', 'LOCATAIRE'];
    expect(roles.filter((r) => can(r, 'lot.manage'))).toEqual(['SYNDIC', 'GESTIONNAIRE']);
  });
});
