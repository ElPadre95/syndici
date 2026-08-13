/**
 * Driver de stockage Vercel Blob (C0) — production, store PRIVÉ. Les objets sont écrits
 * en `access: 'private'` : leur URL n'est PAS atteignable sans jeton. On persiste le
 * `pathname` (clé déterministe) comme référence, et on relit via le `get()` AUTHENTIFIÉ
 * du SDK (jeton), jamais par un `fetch` public. Le contenu n'est de toute façon servi au
 * navigateur que par `/api/files/[id]` après contrôle de droit (signature + session + scope).
 */
import { put as blobPut, get as blobGet, del as blobDel } from '@vercel/blob';
import type { StorageDriver } from '../types';

export function vercelBlobDriver(token: string): StorageDriver {
  return {
    name: 'blob',
    async put(key, body, contentType) {
      const res = await blobPut(key, body, {
        access: 'private',
        addRandomSuffix: false, // clé déterministe (résidence + fileId)
        allowOverwrite: true, // idempotent : un ré-envoi de la même clé ne casse pas
        contentType,
        token,
      });
      return res.pathname; // handle stable pour le get() privé
    },
    async get(ref) {
      const res = await blobGet(ref, { access: 'private', token });
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      return Buffer.from(await new Response(res.stream).arrayBuffer());
    },
    async delete(ref) {
      await blobDel(ref, { token });
    },
  };
}
