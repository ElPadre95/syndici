import type { UploadError } from '@/server/storage/validation';

/** Résultats typés du dépôt de document (F3). */
export type DocumentActionError =
  | 'forbidden'
  | 'no_active_residence'
  | 'file_required'
  | 'title_required'
  | 'invalid_type'
  | 'invalid_scope'
  | UploadError; // 'empty' | 'too_large' | 'unsupported_type'

export type DocumentActionResult = { ok: true } | { ok: false; error: DocumentActionError };
