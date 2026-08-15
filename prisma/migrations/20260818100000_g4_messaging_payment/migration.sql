-- G4 — Messagerie (le mur) + paiement en ligne simulé.

-- 1) LE MUR : discriminateur de rôle sur la conversation. Un lot porte jusqu'à DEUX
--    fils distincts (propriétaire / locataire). On rétro-remplit les fils existants
--    en OWNER (fils syndic ↔ propriétaire) avant de rendre la colonne obligatoire,
--    puis on impose l'unicité (résidence, lot, rôle).
ALTER TABLE "Conversation" ADD COLUMN "counterpartyRole" "AttachmentRole";
UPDATE "Conversation" SET "counterpartyRole" = 'OWNER' WHERE "counterpartyRole" IS NULL;
ALTER TABLE "Conversation" ALTER COLUMN "counterpartyRole" SET NOT NULL;
CREATE UNIQUE INDEX "Conversation_residenceId_lotId_counterpartyRole_key"
  ON "Conversation"("residenceId", "lotId", "counterpartyRole");

-- 2) Pièce jointe optionnelle d'un message (via la couche de stockage FileAsset).
--    ON DELETE SET NULL : supprimer un fichier n'efface jamais le message (journal).
ALTER TABLE "Message" ADD COLUMN "fileAssetId" TEXT;
ALTER TABLE "Message" ADD CONSTRAINT "Message_fileAssetId_fkey"
  FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Message_fileAssetId_idx" ON "Message"("fileAssetId");

-- 3) Paiement en ligne SIMULÉ : drapeau par résidence, désactivé par défaut.
ALTER TABLE "Residence" ADD COLUMN "onlinePaymentEnabled" BOOLEAN NOT NULL DEFAULT false;
