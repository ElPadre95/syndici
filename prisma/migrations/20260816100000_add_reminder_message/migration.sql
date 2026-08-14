-- Relance WhatsApp (E2) : on conserve le TEXTE réellement préparé (preuve en cas de
-- litige ; c'est une intention d'envoi, pas une certitude de réception).
ALTER TABLE "Reminder" ADD COLUMN "message" TEXT;
