/** Résultats typés de la gestion des membres (F4). */
export type MemberActionError =
  | 'forbidden'
  | 'no_active_residence'
  | 'no_organization'
  | 'name_required'
  | 'email_required'
  | 'invalid_email'
  | 'invalid_role'
  | 'not_found'
  | 'last_admin';

export type MemberActionResult = { ok: true } | { ok: false; error: MemberActionError };
