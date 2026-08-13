/**
 * Sélection du driver de stockage (C0). Par défaut : LOCAL (dev, sans réseau). Bascule
 * sur Vercel Blob dès qu'un `BLOB_READ_WRITE_TOKEN` est présent (prod), ou si
 * `STORAGE_DRIVER=blob` est forcé. `driverByName` sert la relecture : chaque fichier
 * porte son driver en préfixe de `storageKey`, donc on relit toujours avec le bon.
 */
import type { StorageDriver } from './types';
import { localDiskDriver } from './drivers/local';
import { vercelBlobDriver } from './drivers/blob';

function localRoot(): string {
  return process.env.STORAGE_DIR ?? '.storage';
}

export function getStorageDriver(): StorageDriver {
  const explicit = process.env.STORAGE_DRIVER;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (explicit === 'blob' || (!explicit && token)) {
    if (!token) throw new Error('STORAGE_DRIVER=blob mais BLOB_READ_WRITE_TOKEN est absent.');
    return vercelBlobDriver(token);
  }
  return localDiskDriver(localRoot());
}

/** Driver correspondant au préfixe stocké (`local` / `blob`). */
export function driverByName(name: string): StorageDriver {
  if (name === 'blob') {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error('Fichier « blob » mais BLOB_READ_WRITE_TOKEN est absent.');
    return vercelBlobDriver(token);
  }
  if (name === 'local') return localDiskDriver(localRoot());
  throw new Error(`Driver de stockage inconnu : ${name}`);
}
