/**
 * Stockage d'objets (C0) — abstraction du fournisseur. Le code métier ne connaît
 * QUE cette interface ; le driver concret (disque local en dev, Vercel Blob en prod,
 * demain S3/R2) est choisi par `getStorageDriver()`. Aucun fournisseur en dur.
 *
 * Un `StorageDriver` ne fait que déplacer des octets : la sécurité (scope résidence,
 * permission, URL signée à durée limitée) vit AU-DESSUS, dans `files.ts` + la route
 * `/api/files/[id]`, identique quel que soit le driver.
 */
export interface StorageDriver {
  /** Identifiant du driver, persisté en préfixe de `FileAsset.storageKey` (`<name>:<ref>`). */
  readonly name: string;
  /**
   * Écrit `body` à un emplacement dérivé de `key` (chemin logique portant la résidence).
   * Renvoie la RÉFÉRENCE durable à persister (chemin pour le local, URL pour Blob).
   */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  /** Relit les octets depuis la référence, ou `null` s'ils sont absents. */
  get(ref: string): Promise<Buffer | null>;
  /** Supprime les octets (best-effort ; ne lève pas si déjà absent). */
  delete(ref: string): Promise<void>;
}

/** Référence d'un fichier telle que lue en base (scopée résidence). */
export interface StoredFileRef {
  id: string;
  residenceId: string;
  bucket: string;
  storageKey: string; // "<driver>:<ref>"
  mimeType: string | null;
  originalName: string | null;
}
