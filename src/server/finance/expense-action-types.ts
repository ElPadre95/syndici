/** Résultats typés des actions de dépense (C1). */
export type ExpenseActionError =
  | 'forbidden'
  | 'no_active_residence'
  | 'invalid_amount'
  | 'invalid_date'
  | 'description_required'
  | 'reason_required'
  | 'not_found'
  | 'already_reversed'
  | 'is_reversal'
  | 'file_unsupported_type'
  | 'file_too_large'
  | 'file_empty';

export type ExpenseActionResult = { ok: true } | { ok: false; error: ExpenseActionError };
