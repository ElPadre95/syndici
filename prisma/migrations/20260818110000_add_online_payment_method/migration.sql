-- Ajoute le mode de paiement EN_LIGNE (paiement en ligne). Utilisé par le tunnel de
-- paiement SIMULÉ (MockProvider) : aucun champ de carte, aucune donnée bancaire collectée
-- — on simule le parcours, le paiement enregistré est bien réel (reçu numéroté).
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'EN_LIGNE';
