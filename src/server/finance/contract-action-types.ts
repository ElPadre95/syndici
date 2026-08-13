/** Résultats typés des actions de contrat fournisseur (C3). */
export type ContractActionError =
  | 'forbidden'
  | 'no_active_residence'
  | 'name_required'
  | 'invalid_amount'
  | 'invalid_date'
  | 'not_found';

export type ContractActionResult = { ok: true } | { ok: false; error: ContractActionError };
