/**
 * Chantiers (I7) — devis comparatifs + photos avant/après. Le cœur de comparaison
 * (`annotateQuotes` : marque le MOINS-DISANT et le devis RETENU) est PUR et testable. Les
 * lectures respectent l'étanchéité : un propriétaire ne voit que les chantiers PARTAGE
 * (jamais l'INTERNE), et les fichiers ne sont signés qu'après ce filtre.
 */
import { forResidence } from '@/server/db/tenant';
import { signedFilePath } from '@/server/storage/sign';
import type { ActiveContext } from '@/server/auth/context';

export type WorksStatus = 'CONSULTATION' | 'EN_COURS' | 'TERMINE';
export type WorksPhase = 'AVANT' | 'APRES';
export type WorksVisibility = 'PARTAGE' | 'INTERNE';

export interface QuoteInput {
  id: string;
  amountMinor: number;
}
export interface AnnotatedQuote {
  id: string;
  cheapest: boolean; // moins-disant (montant le plus bas ; en cas d'égalité, le premier)
  selected: boolean; // devis retenu par le syndic
}

/**
 * Marque, pour un ensemble de devis, le MOINS-DISANT et le devis RETENU. Fonction PURE.
 * Aucun devis → aucune annotation. Le moins-disant est unique (premier en cas d'égalité).
 */
export function annotateQuotes(
  quotes: readonly QuoteInput[],
  selectedQuoteId: string | null,
): AnnotatedQuote[] {
  let cheapestId: string | null = null;
  let min = Number.POSITIVE_INFINITY;
  for (const q of quotes) {
    if (q.amountMinor < min) {
      min = q.amountMinor;
      cheapestId = q.id;
    }
  }
  return quotes.map((q) => ({
    id: q.id,
    cheapest: q.id === cheapestId,
    selected: q.id === selectedQuoteId,
  }));
}

export interface WorksQuoteView {
  id: string;
  supplierName: string;
  amountMinor: number;
  description: string | null;
  receivedOn: string;
  fileHref: string | null;
  cheapest: boolean;
  selected: boolean;
}
export interface WorksPhotoView {
  id: string;
  phase: WorksPhase;
  caption: string | null;
  href: string;
}
export interface WorksProjectDetail {
  id: string;
  title: string;
  description: string;
  status: WorksStatus;
  visibility: WorksVisibility;
  incidentId: string | null;
  selectedQuoteId: string | null;
  quotes: WorksQuoteView[];
  photosBefore: WorksPhotoView[];
  photosAfter: WorksPhotoView[];
}
export interface WorksProjectRow {
  id: string;
  title: string;
  status: WorksStatus;
  visibility: WorksVisibility;
  quoteCount: number;
  photoCount: number;
  selectedAmountMinor: number | null;
  cheapestAmountMinor: number | null;
}

const PROJECT_INCLUDE = {
  quotes: {
    orderBy: { amountMinor: 'asc' as const },
    select: {
      id: true,
      supplierName: true,
      amountMinor: true,
      description: true,
      receivedOn: true,
      fileAssetId: true,
    },
  },
  photos: {
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, phase: true, caption: true, fileAssetId: true },
  },
};

function toDetail(p: {
  id: string;
  title: string;
  description: string;
  status: string;
  visibility: string;
  incidentId: string | null;
  selectedQuoteId: string | null;
  quotes: {
    id: string;
    supplierName: string;
    amountMinor: number;
    description: string | null;
    receivedOn: Date;
    fileAssetId: string | null;
  }[];
  photos: { id: string; phase: string; caption: string | null; fileAssetId: string }[];
}): WorksProjectDetail {
  const marks = new Map(
    annotateQuotes(p.quotes, p.selectedQuoteId).map((a) => [a.id, a]),
  );
  const quotes: WorksQuoteView[] = p.quotes.map((q) => ({
    id: q.id,
    supplierName: q.supplierName,
    amountMinor: q.amountMinor,
    description: q.description,
    receivedOn: q.receivedOn.toISOString(),
    fileHref: q.fileAssetId ? signedFilePath(q.fileAssetId, 3600) : null,
    cheapest: marks.get(q.id)?.cheapest ?? false,
    selected: marks.get(q.id)?.selected ?? false,
  }));
  const photo = (ph: (typeof p.photos)[number]): WorksPhotoView => ({
    id: ph.id,
    phase: ph.phase as WorksPhase,
    caption: ph.caption,
    href: signedFilePath(ph.fileAssetId, 3600),
  });
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    status: p.status as WorksStatus,
    visibility: p.visibility as WorksVisibility,
    incidentId: p.incidentId,
    selectedQuoteId: p.selectedQuoteId,
    quotes,
    photosBefore: p.photos.filter((x) => x.phase === 'AVANT').map(photo),
    photosAfter: p.photos.filter((x) => x.phase === 'APRES').map(photo),
  };
}

/** Liste des chantiers de la résidence (staff : tout ; sinon PARTAGE seulement). */
export async function listWorksProjects(
  ctx: ActiveContext,
  includeInternal: boolean,
): Promise<WorksProjectRow[]> {
  const scoped = forResidence(ctx.residenceId);
  const projects = await scoped.worksProject.findMany({
    where: includeInternal ? {} : { visibility: 'PARTAGE' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      visibility: true,
      selectedQuoteId: true,
      quotes: { select: { id: true, amountMinor: true } },
      _count: { select: { photos: true } },
    },
  });
  return projects.map((p) => {
    const amounts = p.quotes.map((q) => q.amountMinor);
    const selected = p.quotes.find((q) => q.id === p.selectedQuoteId);
    return {
      id: p.id,
      title: p.title,
      status: p.status as WorksStatus,
      visibility: p.visibility as WorksVisibility,
      quoteCount: p.quotes.length,
      photoCount: p._count.photos,
      selectedAmountMinor: selected?.amountMinor ?? null,
      cheapestAmountMinor: amounts.length ? Math.min(...amounts) : null,
    };
  });
}

/** Détail d'un chantier, ou `null` si absent / non visible du lecteur. */
export async function getWorksProject(
  ctx: ActiveContext,
  id: string,
  includeInternal: boolean,
): Promise<WorksProjectDetail | null> {
  const scoped = forResidence(ctx.residenceId);
  const p = await scoped.worksProject.findFirst({
    where: { id, ...(includeInternal ? {} : { visibility: 'PARTAGE' }) },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      visibility: true,
      incidentId: true,
      selectedQuoteId: true,
      ...PROJECT_INCLUDE,
    },
  });
  return p ? toDetail(p) : null;
}

/** Chantiers visibles du propriétaire (PARTAGE), avec devis et photos — pour la transparence. */
export async function listOwnerWorksProjects(ctx: ActiveContext): Promise<WorksProjectDetail[]> {
  const scoped = forResidence(ctx.residenceId);
  const projects = await scoped.worksProject.findMany({
    where: { visibility: 'PARTAGE' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      visibility: true,
      incidentId: true,
      selectedQuoteId: true,
      ...PROJECT_INCLUDE,
    },
  });
  return projects.map(toDetail);
}
