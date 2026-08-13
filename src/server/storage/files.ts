/**
 * Orchestration des fichiers (C0) : écrire un justificatif (validation → driver →
 * `FileAsset`), le relire (scopé résidence), servir ses octets. Le contenu ne vit
 * jamais en base (contrainte SQL anti-base64 sur `FileAsset.storageKey`) : la base ne
 * garde qu'une référence `"<driver>:<ref>"`.
 */
import { randomUUID } from 'node:crypto';
import { forResidence } from '@/server/db/tenant';
import type { SqlExecutor } from '@/server/db/sql';
import { validateUpload, type UploadError } from './validation';
import { storageKeyFor } from './keys';
import { getStorageDriver, driverByName } from './driver';
import type { StoredFileRef } from './types';

export interface StoreFileInput {
  bucket: string; // 'justificatifs' | 'documents' | 'incidents' …
  body: Buffer;
  mimeType: string;
  originalName?: string | null;
  uploadedByPersonId?: string | null;
}

export type StoreFileResult = { ok: true; id: string } | { ok: false; error: UploadError };

/**
 * Valide puis stocke un fichier et crée son `FileAsset` scopé à la résidence. La clé
 * porte la résidence ; le driver (local/blob) est choisi par l'environnement.
 */
export async function storeFile(
  ctx: { residenceId: string },
  input: StoreFileInput,
): Promise<StoreFileResult> {
  const v = validateUpload({ mimeType: input.mimeType, sizeBytes: input.body.length });
  if (!v.ok) return { ok: false, error: v.error };

  const id = randomUUID();
  const key = storageKeyFor(ctx.residenceId, input.bucket, id, v.ext);
  const driver = getStorageDriver();
  const ref = await driver.put(key, input.body, input.mimeType);

  await forResidence(ctx.residenceId).fileAsset.create({
    data: {
      id,
      residenceId: ctx.residenceId,
      bucket: input.bucket,
      storageKey: `${driver.name}:${ref}`,
      mimeType: input.mimeType,
      sizeBytes: input.body.length,
      originalName: input.originalName ?? null,
      uploadedByPersonId: input.uploadedByPersonId ?? null,
    },
  });
  return { ok: true, id };
}

/**
 * Fichier accessible DANS la résidence donnée, ou `null`. Le prédicat `residenceId`
 * est la garde d'isolation : un fichier d'une autre résidence est invisible.
 * Executor-based (SQL brut typé) → testable PGlite ET Postgres réel.
 */
export async function findAccessibleFile(
  exec: SqlExecutor,
  residenceId: string,
  fileId: string,
): Promise<StoredFileRef | null> {
  const rows = await exec.query<StoredFileRef>(
    `SELECT id, "residenceId", bucket, "storageKey", "mimeType", "originalName"
       FROM "FileAsset" WHERE id = $1 AND "residenceId" = $2`,
    [fileId, residenceId],
  );
  return rows[0] ?? null;
}

/** Relit les octets d'un fichier depuis sa `storageKey` (`"<driver>:<ref>"`). */
export async function readStoredFile(storageKey: string): Promise<Buffer | null> {
  const sep = storageKey.indexOf(':');
  if (sep <= 0) return null;
  const name = storageKey.slice(0, sep);
  const ref = storageKey.slice(sep + 1);
  return driverByName(name).get(ref);
}
