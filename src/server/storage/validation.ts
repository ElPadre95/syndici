/**
 * Types acceptés et taille maximale d'un justificatif (C0). Images et PDF
 * uniquement ; refus propre au-delà (le driver n'est jamais sollicité si invalide).
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 Mo — une photo de facture ou un PDF

/** MIME accepté → extension canonique du fichier stocké. */
export const ACCEPTED_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

export type UploadError = 'empty' | 'too_large' | 'unsupported_type';
export type UploadValidation = { ok: true; ext: string } | { ok: false; error: UploadError };

/** Valide le type et la taille d'un envoi. PURE. */
export function validateUpload(input: { mimeType: string; sizeBytes: number }): UploadValidation {
  if (input.sizeBytes <= 0) return { ok: false, error: 'empty' };
  if (input.sizeBytes > MAX_UPLOAD_BYTES) return { ok: false, error: 'too_large' };
  const ext = ACCEPTED_MIME[input.mimeType.toLowerCase()];
  if (!ext) return { ok: false, error: 'unsupported_type' };
  return { ok: true, ext };
}
