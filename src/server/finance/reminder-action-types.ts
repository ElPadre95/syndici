/** Résultats typés de l'action de relance (E2). */
export type ReminderActionError =
  'forbidden' | 'no_active_residence' | 'not_found' | 'empty_message';

export type ReminderActionResult = { ok: true } | { ok: false; error: ReminderActionError };
