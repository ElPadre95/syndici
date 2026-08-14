/**
 * Documents (F3). Dépôt (titre, type, portée) et lecture filtrée par l'étanchéité pure
 * (`documentVisibleTo`). Scopé à la résidence active via `forResidence`. Le fichier vit
 * dans la couche de stockage C0 (jamais refaite) ; le document ne porte qu'une référence
 * `fileAssetId` servie par la route signée `/api/files/[id]`.
 */
import { forResidence } from '@/server/db/tenant';
import type { ActiveContext } from '@/server/auth/context';
import { documentVisibleTo, type DocumentScope, type DocumentType } from './visibility';

export interface DocumentView {
  id: string;
  fileAssetId: string;
  name: string;
  type: DocumentType;
  scope: DocumentScope;
  origin: string;
  lotReference: string | null;
  uploadedByPersonId: string | null;
  createdAt: string;
}

const SELECT = {
  id: true,
  fileAssetId: true,
  name: true,
  type: true,
  scope: true,
  origin: true,
  createdAt: true,
  lot: { select: { reference: true } },
  fileAsset: { select: { uploadedByPersonId: true } },
} as const;

type Row = {
  id: string;
  fileAssetId: string;
  name: string;
  type: string;
  scope: string;
  origin: string;
  createdAt: Date;
  lot: { reference: string } | null;
  fileAsset: { uploadedByPersonId: string | null };
};

function toView(r: Row): DocumentView {
  return {
    id: r.id,
    fileAssetId: r.fileAssetId,
    name: r.name,
    type: r.type as DocumentType,
    scope: r.scope as DocumentScope,
    origin: r.origin,
    lotReference: r.lot?.reference ?? null,
    uploadedByPersonId: r.fileAsset.uploadedByPersonId,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Documents de la résidence que ce contexte a le DROIT de voir (étanchéité appliquée). */
export async function listVisibleDocuments(ctx: ActiveContext): Promise<DocumentView[]> {
  const rows = (await forResidence(ctx.residenceId).document.findMany({
    orderBy: { createdAt: 'desc' },
    select: SELECT,
  })) as Row[];
  return rows
    .map(toView)
    .filter((d) =>
      documentVisibleTo(
        { scope: d.scope, uploadedByPersonId: d.uploadedByPersonId },
        { personId: ctx.personId, role: ctx.role },
      ),
    );
}

/** Documents « visibles de toute la résidence » — pour l'accueil du résident. */
export async function listResidenceDocuments(ctx: ActiveContext): Promise<DocumentView[]> {
  const rows = (await forResidence(ctx.residenceId).document.findMany({
    where: { scope: 'RESIDENCE' },
    orderBy: { createdAt: 'desc' },
    select: SELECT,
  })) as Row[];
  return rows.map(toView);
}

export interface CreateDocumentInput {
  fileAssetId: string;
  name: string;
  type: DocumentType;
  scope: DocumentScope;
  lotId?: string | null;
  personId?: string | null;
}

/** Enregistre un document (le fichier a déjà été stocké en amont). */
export async function createDocument(
  ctx: ActiveContext,
  input: CreateDocumentInput,
): Promise<string> {
  const created = await forResidence(ctx.residenceId).document.create({
    data: {
      residenceId: ctx.residenceId,
      fileAssetId: input.fileAssetId,
      name: input.name,
      type: input.type,
      scope: input.scope,
      origin: 'GERANT',
      lotId: input.lotId ?? null,
      personId: input.personId ?? null,
    },
    select: { id: true },
  });
  return created.id;
}
