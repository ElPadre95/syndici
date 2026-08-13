-- Ajoute le mode de paiement CHEQUE (chèque, courant au Maroc). CARTE est conservé
-- pour les données existantes mais n'est plus proposé (aucun paiement par carte).
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHEQUE';
