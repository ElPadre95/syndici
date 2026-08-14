/**
 * Actualités (E3) — filtre d'audience (cœur PUR). Un propriétaire ne voit pas les
 * actualités destinées aux locataires, et inversement ; le staff voit tout.
 */
import { describe, it, expect } from 'vitest';
import { audiencesFor } from './data';

describe('audiencesFor', () => {
  it('un propriétaire voit ALL + OWNERS (pas TENANTS)', () => {
    expect(audiencesFor('PROPRIETAIRE')).toEqual(['ALL', 'OWNERS']);
  });

  it('un locataire voit ALL + TENANTS (pas OWNERS)', () => {
    expect(audiencesFor('LOCATAIRE')).toEqual(['ALL', 'TENANTS']);
  });

  it('le staff voit toutes les audiences', () => {
    expect(audiencesFor('SYNDIC')).toEqual(['ALL', 'OWNERS', 'TENANTS']);
    expect(audiencesFor('GESTIONNAIRE')).toEqual(['ALL', 'OWNERS', 'TENANTS']);
  });
});
