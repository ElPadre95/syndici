/**
 * Service des fichiers (C0). Seul point d'accès aux octets d'un justificatif. Trois
 * gardes cumulées : (1) signature HMAC valide et non expirée, (2) session authentifiée,
 * (3) le fichier appartient à la résidence ACTIVE de la session (isolation multi-résidences).
 * L'URL du fournisseur (Blob) n'est jamais exposée ; on relit et on renvoie les octets.
 */
import type { NextRequest } from 'next/server';
import { getSessionContext } from '@/server/session';
import { prismaExecutor } from '@/server/db/sql';
import { verifyFileToken } from '@/server/storage/sign';
import { findAccessibleFile, readStoredFile } from '@/server/storage/files';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const exp = Number(req.nextUrl.searchParams.get('exp'));
  const sig = req.nextUrl.searchParams.get('sig') ?? '';
  const now = Math.floor(Date.now() / 1000);
  if (!verifyFileToken(id, exp, sig, now)) {
    return new Response('Lien de fichier invalide ou expiré.', { status: 403 });
  }

  const ctx = await getSessionContext();
  if (!ctx?.activeId) return new Response('Non authentifié.', { status: 401 });

  // Isolation : ne résout que dans la résidence active de la session.
  const file = await findAccessibleFile(prismaExecutor(), ctx.activeId, id);
  if (!file) return new Response('Fichier introuvable.', { status: 404 });

  const bytes = await readStoredFile(file.storageKey);
  if (!bytes) return new Response('Contenu du fichier absent.', { status: 404 });

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': file.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalName ?? id)}"`,
      'Cache-Control': 'private, max-age=60',
    },
  });
}
