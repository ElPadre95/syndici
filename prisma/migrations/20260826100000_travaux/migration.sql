-- I7 — Chantiers : devis comparatifs + photos avant/après.

CREATE TYPE "WorksStatus" AS ENUM ('CONSULTATION', 'EN_COURS', 'TERMINE');
CREATE TYPE "WorksPhase" AS ENUM ('AVANT', 'APRES');

-- Projet de travaux (regroupe devis + photos).
CREATE TABLE "WorksProject" (
  "id" TEXT NOT NULL,
  "residenceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "WorksStatus" NOT NULL DEFAULT 'CONSULTATION',
  "visibility" "ExpenseVisibility" NOT NULL DEFAULT 'PARTAGE',
  "incidentId" TEXT,
  "selectedQuoteId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorksProject_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorksProject_residenceId_idx" ON "WorksProject"("residenceId");
CREATE INDEX "WorksProject_incidentId_idx" ON "WorksProject"("incidentId");
ALTER TABLE "WorksProject" ADD CONSTRAINT "WorksProject_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorksProject" ADD CONSTRAINT "WorksProject_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Devis reçu (fournisseur libre, montant, PDF du devis).
CREATE TABLE "WorksQuote" (
  "id" TEXT NOT NULL,
  "residenceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "supplierName" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "description" TEXT,
  "fileAssetId" TEXT,
  "receivedOn" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorksQuote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorksQuote_residenceId_idx" ON "WorksQuote"("residenceId");
CREATE INDEX "WorksQuote_projectId_idx" ON "WorksQuote"("projectId");
ALTER TABLE "WorksQuote" ADD CONSTRAINT "WorksQuote_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorksQuote" ADD CONSTRAINT "WorksQuote_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "WorksProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorksQuote" ADD CONSTRAINT "WorksQuote_fileAssetId_fkey"
  FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Photo avant/après (fichier obligatoire).
CREATE TABLE "WorksPhoto" (
  "id" TEXT NOT NULL,
  "residenceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "phase" "WorksPhase" NOT NULL,
  "caption" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorksPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorksPhoto_residenceId_idx" ON "WorksPhoto"("residenceId");
CREATE INDEX "WorksPhoto_projectId_idx" ON "WorksPhoto"("projectId");
ALTER TABLE "WorksPhoto" ADD CONSTRAINT "WorksPhoto_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorksPhoto" ADD CONSTRAINT "WorksPhoto_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "WorksProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorksPhoto" ADD CONSTRAINT "WorksPhoto_fileAssetId_fkey"
  FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
