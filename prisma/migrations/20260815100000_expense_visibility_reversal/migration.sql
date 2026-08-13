-- Dépenses (C1) : visibilité (transparence pilotable) + annulation par écriture inverse.

CREATE TYPE "ExpenseVisibility" AS ENUM ('PARTAGE', 'INTERNE');

ALTER TABLE "Expense"
  ADD COLUMN "visibility" "ExpenseVisibility" NOT NULL DEFAULT 'PARTAGE',
  ADD COLUMN "reversesExpenseId" TEXT;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_reversesExpenseId_fkey"
  FOREIGN KEY ("reversesExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Expense_reversesExpenseId_idx" ON "Expense"("reversesExpenseId");

-- L'annulation par écriture inverse (comme les paiements) crée une dépense NÉGATIVE.
-- On remplace donc la contrainte « >= 0 » (héritée du modèle void) par « <> 0 »,
-- alignée sur `payment_amount_nonzero`.
ALTER TABLE "Expense" DROP CONSTRAINT "expense_amount_nonneg";
ALTER TABLE "Expense" ADD CONSTRAINT "expense_amount_nonzero" CHECK ("amountMinor" <> 0);
