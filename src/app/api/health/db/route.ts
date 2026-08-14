/**
 * Sonde TEMPORAIRE de diagnostic perf (à retirer). Mesure le coût d'un aller-retour DB
 * depuis la fonction (fra1) vers Neon (Francfort), et vérifie que `DATABASE_URL` (poolée)
 * fonctionne bien en production. Public exprès (aucune donnée sensible renvoyée).
 */
import { getBaseClient } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const prisma = getBaseClient();
  try {
    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`; // 1er : inclut l'établissement de connexion
    const cold = performance.now() - t0;
    const t1 = performance.now();
    await prisma.$queryRaw`SELECT 1`; // 2e : connexion réutilisée
    const warm = performance.now() - t1;
    const t2 = performance.now();
    await prisma.residence.count(); // requête applicative réelle
    const countMs = performance.now() - t2;
    return Response.json({
      ok: true,
      region: process.env.VERCEL_REGION ?? null,
      firstQueryMs: Math.round(cold),
      secondQueryMs: Math.round(warm),
      countQueryMs: Math.round(countMs),
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
