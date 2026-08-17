'use server';

/**
 * Action staff : marquer une demande de contact traitée / à rouvrir (J1). Gardée par l'accès
 * STAFF (au moins un mandat actif) — les demandes de la vitrine ne concernent pas les résidents.
 * Table globale, donc pas de contrôle par résidence : le garde est le statut staff de la session.
 */
import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/server/session';
import { setContactRequestHandled } from './data';

export type HandleResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' };

export async function setContactHandledAction(id: string, handled: boolean): Promise<HandleResult> {
  const ctx = await getSessionContext();
  if (!ctx?.isStaff) return { ok: false, error: 'forbidden' };
  if (typeof id !== 'string' || id.length < 8) return { ok: false, error: 'invalid' };

  await setContactRequestHandled(id, handled);
  revalidatePath('/', 'layout');
  return { ok: true };
}
