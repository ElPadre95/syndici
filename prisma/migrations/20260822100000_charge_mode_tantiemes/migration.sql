-- I1 — Mode de calcul des appels de charges : forfait (défaut) ou tantièmes.
CREATE TYPE "ChargeMode" AS ENUM ('FORFAIT', 'TANTIEMES');
ALTER TABLE "Residence" ADD COLUMN "chargeMode" "ChargeMode" NOT NULL DEFAULT 'FORFAIT';
-- Total mensuel de la résidence, réparti aux quotes-parts en mode tantièmes.
ALTER TABLE "Residence" ADD COLUMN "monthlyBudgetMinor" INTEGER NOT NULL DEFAULT 0;
