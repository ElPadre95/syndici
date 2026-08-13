/** Résultats des actions d'encaissement (partagés action serveur ↔ UI). */
export type PaymentActionError =
  | 'forbidden'
  | 'no_active_residence'
  | 'invalid_amount'
  | 'invalid_method'
  | 'invalid_date'
  | 'not_found'
  | 'reason_required'
  | 'already_reversed'
  | 'is_reversal';

export type PaymentActionResult = { ok: true } | { ok: false; error: PaymentActionError };
