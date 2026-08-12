'use server';

/**
 * Actions d'import de lots (A7). Deux temps, RIEN n'est écrit avant confirmation :
 *   - previewImportAction : lit le fichier, le confronte à l'existant, renvoie l'aperçu ;
 *   - commitImportAction : relit LE MÊME fichier et écrit les lignes valides en UNE
 *     transaction. Relire (au lieu de faire confiance à un aperçu renvoyé par le
 *     client) garantit que ce qui est écrit = ce qui a été prévisualisé.
 *
 * Toute action passe par le point d'application des autorisations (`lot.manage`) :
 * un gestionnaire peut importer, un résident non.
 */
import { revalidatePath } from 'next/cache';
import { forResidence } from '@/server/db/tenant';
import { prismaTxRunner } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { parseImport, ImportFileError } from './parse';
import { planImport } from './plan';
import { commitImport } from './commit';
import type { PreviewResult, CommitResult, ImportActionError } from './action-types';

type Importer =
  | { ok: true; residenceId: string; role: 'SYNDIC' | 'GESTIONNAIRE' }
  | { ok: false; error: 'forbidden' | 'no_active_residence' };

async function requireImporter(): Promise<Importer> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'lot.manage')) return { ok: false, error: 'forbidden' };
  // `lot.manage` n'est accordé qu'au staff (SYNDIC/GESTIONNAIRE).
  return { ok: true, residenceId: ctx.activeId, role: ctx.role as 'SYNDIC' | 'GESTIONNAIRE' };
}

async function readFile(formData: FormData): Promise<ArrayBuffer | null> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return null;
  return file.arrayBuffer();
}

async function existingReferences(residenceId: string): Promise<Set<string>> {
  const lots = await forResidence(residenceId).lot.findMany({ select: { reference: true } });
  return new Set(lots.map((l) => l.reference));
}

function fileErrorCode(e: unknown): ImportActionError {
  return e instanceof ImportFileError ? e.code : 'unreadable';
}

export async function previewImportAction(formData: FormData): Promise<PreviewResult> {
  const imp = await requireImporter();
  if (!imp.ok) return { ok: false, error: imp.error };

  const buf = await readFile(formData);
  if (!buf) return { ok: false, error: 'unreadable' };
  const filename = String(formData.get('filename') ?? 'import.xlsx');

  try {
    const sheet = await parseImport(buf, filename);
    const plan = planImport(sheet, await existingReferences(imp.residenceId));
    return { ok: true, plan };
  } catch (e) {
    return { ok: false, error: fileErrorCode(e) };
  }
}

export async function commitImportAction(formData: FormData): Promise<CommitResult> {
  const imp = await requireImporter();
  if (!imp.ok) return { ok: false, error: imp.error };

  const buf = await readFile(formData);
  if (!buf) return { ok: false, error: 'unreadable' };
  const filename = String(formData.get('filename') ?? 'import.xlsx');

  try {
    const sheet = await parseImport(buf, filename);
    const plan = planImport(sheet, await existingReferences(imp.residenceId));
    const createRows = plan.rows.filter((r) => r.status === 'create');
    const ignored = plan.counts.exists + plan.counts.reject;
    const report = await commitImport(
      prismaTxRunner(),
      { residenceId: imp.residenceId, role: imp.role },
      createRows,
      plan.hasQuotePartColumn,
      ignored,
    );
    revalidatePath('/', 'layout');
    return { ok: true, report };
  } catch (e) {
    return { ok: false, error: fileErrorCode(e) };
  }
}
