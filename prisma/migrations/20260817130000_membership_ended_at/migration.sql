-- F4 : retrait d'un membre = fin d'accès datée, jamais une suppression. Le statut passe
-- à ENDED et cette colonne porte la date de fin (l'historique du rattachement reste).
ALTER TABLE "Membership" ADD COLUMN "endedAt" TIMESTAMP(3);
