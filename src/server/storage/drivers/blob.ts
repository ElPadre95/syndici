/**
 * Driver de stockage Vercel Blob (C0) — production. La référence persistée est l'URL
 * renvoyée par Blob. IMPORTANT : cette URL n'est JAMAIS communiquée au navigateur ; le
 * contenu n'est servi que par `/api/files/[id]` après contrôle de droit et via une URL
 * signée à durée limitée. (Vercel Blob n'expose que des URLs « public » à suffixe
 * aléatoire ; on ne s'y appuie donc pas pour l'autorisation — elle vit dans notre route.
 * Un stockage à URLs pré-signées privées, ex. S3/R2, se brancherait ici sans toucher au
 * code métier.)
 */
import { put as blobPut, del as blobDel } from '@vercel/blob';
import type { StorageDriver } from '../types';

export function vercelBlobDriver(token: string): StorageDriver {
  return {
    name: 'blob',
    async put(key, body, contentType) {
      const res = await blobPut(key, body, {
        access: 'public',
        addRandomSuffix: false, // clé déterministe = idempotence (résidence + fileId)
        contentType,
        token,
      });
      return res.url;
    },
    async get(ref) {
      const r = await fetch(ref);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    },
    async delete(ref) {
      await blobDel(ref, { token });
    },
  };
}
