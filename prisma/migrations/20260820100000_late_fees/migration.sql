-- H2 — Frais de retard CONFIGURABLES (désactivés par défaut). Config sur la résidence :
-- part fixe + part proportionnelle (points de base) + plafond optionnel. Le seuil en jours
-- vit déjà sur la règle de relance (`lateFeeThresholdDays`).
ALTER TABLE "Residence" ADD COLUMN "lateFeeFixedMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Residence" ADD COLUMN "lateFeePercentBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Residence" ADD COLUMN "lateFeeCapMinor" INTEGER;

-- Frais de retard : écriture au débit d'un lot, IMMUABLE. Annulation par écriture inverse.
CREATE TABLE "LateFee" (
  "id" TEXT NOT NULL,
  "residenceId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "chargeCallId" TEXT,
  "amountMinor" INTEGER NOT NULL,
  "reason" TEXT,
  "reminderRuleId" TEXT,
  "reversesLateFeeId" TEXT,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LateFee_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LateFee_residenceId_idx" ON "LateFee"("residenceId");
CREATE INDEX "LateFee_lotId_idx" ON "LateFee"("lotId");
-- Idempotence : au plus UN frais ORIGINAL par appel en retard (repasser le job ne double
-- jamais). Les écritures INVERSES portent chargeCallId NULL (NULLs distincts en Postgres).
CREATE UNIQUE INDEX "LateFee_chargeCallId_key" ON "LateFee"("chargeCallId");

ALTER TABLE "LateFee" ADD CONSTRAINT "LateFee_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LateFee" ADD CONSTRAINT "LateFee_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LateFee" ADD CONSTRAINT "LateFee_chargeCallId_fkey"
  FOREIGN KEY ("chargeCallId") REFERENCES "ChargeCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LateFee" ADD CONSTRAINT "LateFee_reversesLateFeeId_fkey"
  FOREIGN KEY ("reversesLateFeeId") REFERENCES "LateFee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
