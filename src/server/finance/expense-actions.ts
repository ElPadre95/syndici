'use server';

/**
 * Actions de dépense (C1). Saisir une dépense (avec justificatif photographié/scanné) ou
 * l'annuler par écriture inverse. Gardé par `can(role, 'expense.manage')` — staff. Le
 * justificatif passe par la couche de stockage (validation type/taille, scope résidence).
 */
import { revalidatePath } from 'next/cache';
import { prismaTxRunner } from '@/server/db/sql';
import { getSessionContext } from '@/server/session';
import { can, type AppRole } from '@/server/auth/permissions';
import { parseMoneyToCentimes } from '@/server/import/normalize';
import { storeFile } from '@/server/storage/files';
import type { UploadError } from '@/server/storage/validation';
import {
  writeExpense,
  reverseExpense,
  EXPENSE_VISIBILITIES,
  type ExpenseVisibility,
} from './expenses';
import type { ExpenseActionResult } from './expense-action-types';

type Manager =
  | { ok: true; ctx: { personId: string; residenceId: string; role: AppRole } }
  | { ok: false; error: 'forbidden' | 'no_active_residence' };

async function requireExpenseManager(): Promise<Manager> {
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role) return { ok: false, error: 'no_active_residence' };
  if (!can(ctx.role, 'expense.manage')) return { ok: false, error: 'forbidden' };
  return { ok: true, ctx: { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role } };
}

const UPLOAD_ERROR: Record<UploadError, ExpenseActionResult & { ok: false }> = {
  unsupported_type: { ok: false, error: 'file_unsupported_type' },
  too_large: { ok: false, error: 'file_too_large' },
  empty: { ok: false, error: 'file_empty' },
};

export async function recordExpenseAction(formData: FormData): Promise<ExpenseActionResult> {
  const rec = await requireExpenseManager();
  if (!rec.ok) return { ok: false, error: rec.error };

  const description = String(formData.get('description') ?? '').trim();
  if (!description) return { ok: false, error: 'description_required' };

  const amountMinor = parseMoneyToCentimes(String(formData.get('amount') ?? ''));
  if (amountMinor === null || amountMinor <= 0) return { ok: false, error: 'invalid_amount' };

  const spentStr = String(formData.get('spentOn') ?? '');
  const spentOn = spentStr ? new Date(spentStr) : new Date();
  if (Number.isNaN(spentOn.getTime())) return { ok: false, error: 'invalid_date' };

  const categoryId = String(formData.get('categoryId') ?? '').trim() || null;
  const supplierName = String(formData.get('supplierName') ?? '').trim() || null;
  const rawVis = String(formData.get('visibility') ?? 'PARTAGE');
  const visibility: ExpenseVisibility = EXPENSE_VISIBILITIES.includes(rawVis as ExpenseVisibility)
    ? (rawVis as ExpenseVisibility)
    : 'PARTAGE';

  // Justificatif (optionnel) : photo ou scan. Stocké avant l'écriture de la dépense.
  let justificatifId: string | null = null;
  const file = formData.get('justificatif');
  if (file instanceof File && file.size > 0) {
    const body = Buffer.from(await file.arrayBuffer());
    const stored = await storeFile(
      { residenceId: rec.ctx.residenceId },
      {
        bucket: 'justificatifs',
        body,
        mimeType: file.type,
        originalName: file.name,
        uploadedByPersonId: rec.ctx.personId,
      },
    );
    if (!stored.ok) return UPLOAD_ERROR[stored.error];
    justificatifId = stored.id;
  }

  await writeExpense(prismaTxRunner(), {
    residenceId: rec.ctx.residenceId,
    categoryId,
    description,
    amountMinor,
    spentOn,
    supplierName,
    visibility,
    justificatifId,
    actorPersonId: rec.ctx.personId,
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function reverseExpenseAction(formData: FormData): Promise<ExpenseActionResult> {
  const rec = await requireExpenseManager();
  if (!rec.ok) return { ok: false, error: rec.error };

  const expenseId = String(formData.get('expenseId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) return { ok: false, error: 'reason_required' };

  const res = await reverseExpense(prismaTxRunner(), {
    residenceId: rec.ctx.residenceId,
    expenseId,
    reason,
    actorPersonId: rec.ctx.personId,
  });
  if (!res.ok) return { ok: false, error: res.reason };
  revalidatePath('/', 'layout');
  return { ok: true };
}
