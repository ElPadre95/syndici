/** Résultats typés de la publication d'actualité (E3). */
export type AnnouncementActionError =
  | 'forbidden'
  | 'no_active_residence'
  | 'title_required'
  | 'body_required'
  | 'invalid_type'
  | 'invalid_audience';

export type AnnouncementActionResult = { ok: true } | { ok: false; error: AnnouncementActionError };
