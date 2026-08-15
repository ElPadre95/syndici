-- H5 — Devise secondaire (conversion INDICATIVE dans l'espace propriétaire).
-- Choix du propriétaire (null = désactivé, défaut).
ALTER TABLE "Person" ADD COLUMN "secondaryCurrency" TEXT;

-- Taux de change indicatif : donnée de configuration (jamais un appel externe), par
-- résidence, avec sa date. `madPerUnitMinor` = centimes de dirham pour 1 unité de devise.
CREATE TABLE "CurrencyRate" (
  "id" TEXT NOT NULL,
  "residenceId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "madPerUnitMinor" INTEGER NOT NULL,
  "asOfDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CurrencyRate_residenceId_currency_key" ON "CurrencyRate"("residenceId", "currency");
CREATE INDEX "CurrencyRate_residenceId_idx" ON "CurrencyRate"("residenceId");
ALTER TABLE "CurrencyRate" ADD CONSTRAINT "CurrencyRate_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
