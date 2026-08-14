-- F3 : typage des documents (règlement, PV d'AG, assurance, attestation, autre) pour
-- classer et filtrer. Nouveau type (CREATE, sans risque transactionnel) + colonne à
-- défaut AUTRE pour les lignes existantes.
CREATE TYPE "DocumentType" AS ENUM ('REGLEMENT', 'PV_AG', 'ASSURANCE', 'ATTESTATION', 'AUTRE');

ALTER TABLE "Document" ADD COLUMN "type" "DocumentType" NOT NULL DEFAULT 'AUTRE';
