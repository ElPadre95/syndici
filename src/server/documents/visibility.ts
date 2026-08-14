/**
 * Portées de visibilité des documents (F3) — cœur PUR de l'étanchéité, testé.
 *
 * Le « déposant » d'un document est l'auteur de son fichier (`FileAsset.uploadedByPersonId`) :
 * le modèle `Document` ne porte pas d'uploader propre. Les règles :
 *   - RESIDENCE : visible de TOUTE la résidence (règlement, PV d'AG…) ;
 *   - PRIVE     : le déposant SEUL — même le syndic ne voit pas le privé d'un résident ;
 *   - PARTAGE   : le déposant OU le staff (jamais un autre résident) ;
 *   - INTERNE   : le staff seul (dossier interne, invisible du résident).
 */
import type { AppRole } from '@/server/auth/permissions';

export type DocumentScope = 'PRIVE' | 'PARTAGE' | 'INTERNE' | 'RESIDENCE';
export type DocumentType = 'REGLEMENT' | 'PV_AG' | 'ASSURANCE' | 'ATTESTATION' | 'AUTRE';

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'REGLEMENT',
  'PV_AG',
  'ASSURANCE',
  'ATTESTATION',
  'AUTRE',
];

/**
 * Portées proposées au dépôt (les trois du cahier des charges F3). `INTERNE` reste une
 * valeur valide en base (dossier syndic) mais n'est pas un choix de dépôt.
 */
export const DEPOSABLE_SCOPES: readonly DocumentScope[] = ['PRIVE', 'PARTAGE', 'RESIDENCE'];

function isStaffRole(role: AppRole): boolean {
  return role === 'SYNDIC' || role === 'GESTIONNAIRE';
}

export interface DocumentViewer {
  personId: string;
  role: AppRole;
}

export interface VisibilityDoc {
  scope: DocumentScope;
  uploadedByPersonId: string | null;
}

/** Un document est-il visible par ce lecteur ? (étanchéité F3) */
export function documentVisibleTo(doc: VisibilityDoc, viewer: DocumentViewer): boolean {
  const staff = isStaffRole(viewer.role);
  switch (doc.scope) {
    case 'RESIDENCE':
      return true;
    case 'PRIVE':
      return doc.uploadedByPersonId !== null && doc.uploadedByPersonId === viewer.personId;
    case 'PARTAGE':
      return (
        staff || (doc.uploadedByPersonId !== null && doc.uploadedByPersonId === viewer.personId)
      );
    case 'INTERNE':
      return staff;
    default:
      return false;
  }
}
