-- I3 — Régularisation annuelle : provisions appelées vs quote-part réelle des dépenses.

-- En-tête : une régularisation par exercice (au plus une ACTIVE — index partiel plus bas).
CREATE TABLE "Regularisation" (
  "id" TEXT NOT NULL,
  "residenceId" TEXT NOT NULL,
  "exercice" INTEGER NOT NULL,
  "effectiveOn" DATE NOT NULL,
  "totalExpensesMinor" INTEGER NOT NULL,
  "totalProvisionsMinor" INTEGER NOT NULL,
  "voidedAt" TIMESTAMP(3),
  "voidedReason" TEXT,
  "actorPersonId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Regularisation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Regularisation_residenceId_idx" ON "Regularisation"("residenceId");
ALTER TABLE "Regularisation" ADD CONSTRAINT "Regularisation_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Idempotence : AU PLUS une régularisation active par (résidence, exercice). Une régularisation
-- annulée (voidedAt renseigné) libère la place pour en refaire une.
CREATE UNIQUE INDEX "Regularisation_active_per_exercice"
  ON "Regularisation"("residenceId", "exercice")
  WHERE "voidedAt" IS NULL;

-- Ligne par lot : provisions appelées, quote-part réelle, écart (supplément/avoir).
CREATE TABLE "RegularisationLine" (
  "id" TEXT NOT NULL,
  "regularisationId" TEXT NOT NULL,
  "residenceId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "provisionsMinor" INTEGER NOT NULL,
  "quotePartMinor" INTEGER NOT NULL,
  "adjustmentMinor" INTEGER NOT NULL,
  CONSTRAINT "RegularisationLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RegularisationLine_residenceId_idx" ON "RegularisationLine"("residenceId");
CREATE INDEX "RegularisationLine_regularisationId_idx" ON "RegularisationLine"("regularisationId");
CREATE INDEX "RegularisationLine_lotId_idx" ON "RegularisationLine"("lotId");
ALTER TABLE "RegularisationLine" ADD CONSTRAINT "RegularisationLine_regularisationId_fkey"
  FOREIGN KEY ("regularisationId") REFERENCES "Regularisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegularisationLine" ADD CONSTRAINT "RegularisationLine_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegularisationLine" ADD CONSTRAINT "RegularisationLine_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
