/**
 * Documents (F3) — ÉTANCHÉITÉ des portées, cœur pur. On prouve les trois invariants du
 * cahier des charges + le dossier interne :
 *   - un document PRIVE n'est visible que de son déposant ;
 *   - un document PARTAGE avec le syndic n'est pas visible des AUTRES résidents ;
 *   - un locataire ne voit jamais le PRIVE du propriétaire de son lot ;
 *   - RESIDENCE est visible de tous ; INTERNE, du staff seul.
 */
import { describe, it, expect } from 'vitest';
import { documentVisibleTo, type VisibilityDoc, type DocumentViewer } from './visibility';

const OWNER = 'person-owner';
const TENANT = 'person-tenant';
const OTHER = 'person-other';

const owner: DocumentViewer = { personId: OWNER, role: 'PROPRIETAIRE' };
const tenant: DocumentViewer = { personId: TENANT, role: 'LOCATAIRE' };
const otherResident: DocumentViewer = { personId: OTHER, role: 'PROPRIETAIRE' };
const syndic: DocumentViewer = { personId: 'person-syndic', role: 'SYNDIC' };
const gestionnaire: DocumentViewer = { personId: 'person-gest', role: 'GESTIONNAIRE' };

describe('documentVisibleTo', () => {
  it('PRIVE : visible du déposant SEUL — même pas du syndic', () => {
    const doc: VisibilityDoc = { scope: 'PRIVE', uploadedByPersonId: OWNER };
    expect(documentVisibleTo(doc, owner)).toBe(true);
    expect(documentVisibleTo(doc, syndic)).toBe(false);
    expect(documentVisibleTo(doc, otherResident)).toBe(false);
  });

  it('un locataire ne voit JAMAIS le PRIVE du propriétaire de son lot', () => {
    const ownerPrivate: VisibilityDoc = { scope: 'PRIVE', uploadedByPersonId: OWNER };
    expect(documentVisibleTo(ownerPrivate, tenant)).toBe(false);
  });

  it('PARTAGE : déposant + staff, jamais un autre résident', () => {
    const doc: VisibilityDoc = { scope: 'PARTAGE', uploadedByPersonId: OWNER };
    expect(documentVisibleTo(doc, owner)).toBe(true); // le déposant
    expect(documentVisibleTo(doc, syndic)).toBe(true); // le syndic
    expect(documentVisibleTo(doc, gestionnaire)).toBe(true); // le staff
    expect(documentVisibleTo(doc, otherResident)).toBe(false); // un autre résident : non
    expect(documentVisibleTo(doc, tenant)).toBe(false);
  });

  it('RESIDENCE : visible de toute la résidence', () => {
    const doc: VisibilityDoc = { scope: 'RESIDENCE', uploadedByPersonId: 'person-syndic' };
    expect(documentVisibleTo(doc, owner)).toBe(true);
    expect(documentVisibleTo(doc, tenant)).toBe(true);
    expect(documentVisibleTo(doc, otherResident)).toBe(true);
    expect(documentVisibleTo(doc, syndic)).toBe(true);
  });

  it('INTERNE : staff seul', () => {
    const doc: VisibilityDoc = { scope: 'INTERNE', uploadedByPersonId: 'person-syndic' };
    expect(documentVisibleTo(doc, syndic)).toBe(true);
    expect(documentVisibleTo(doc, gestionnaire)).toBe(true);
    expect(documentVisibleTo(doc, owner)).toBe(false);
    expect(documentVisibleTo(doc, tenant)).toBe(false);
  });

  it('un document sans déposant connu n’est PRIVE de personne', () => {
    const doc: VisibilityDoc = { scope: 'PRIVE', uploadedByPersonId: null };
    expect(documentVisibleTo(doc, owner)).toBe(false);
    expect(documentVisibleTo(doc, syndic)).toBe(false);
  });
});
