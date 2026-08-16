-- I2 — Budget prévisionnel + fonds de provisions travaux.

-- Une dépense peut être imputée sur le fonds travaux (exclue de la trésorerie courante).
ALTER TABLE "Expense" ADD COLUMN "onWorksFund" BOOLEAN NOT NULL DEFAULT false;

-- Budget prévisionnel : montant voté par catégorie et par exercice.
CREATE TABLE "BudgetLine" (
  "id" TEXT NOT NULL,
  "residenceId" TEXT NOT NULL,
  "exercice" INTEGER NOT NULL,
  "categoryId" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BudgetLine_residenceId_exercice_categoryId_key"
  ON "BudgetLine"("residenceId", "exercice", "categoryId");
CREATE INDEX "BudgetLine_residenceId_idx" ON "BudgetLine"("residenceId");
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fonds de provisions travaux : contributions (appels dédiés), distinct de la trésorerie.
CREATE TABLE "WorksFundContribution" (
  "id" TEXT NOT NULL,
  "residenceId" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "occurredOn" DATE NOT NULL,
  "reversesContributionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorksFundContribution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorksFundContribution_residenceId_idx" ON "WorksFundContribution"("residenceId");
ALTER TABLE "WorksFundContribution" ADD CONSTRAINT "WorksFundContribution_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
