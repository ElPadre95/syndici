-- I4 — Escalade de recouvrement : rappel amiable → mise en demeure (lettre formelle).

-- Étape d'escalade portée par chaque relance.
CREATE TYPE "ReminderKind" AS ENUM ('RAPPEL', 'MISE_EN_DEMEURE');
ALTER TABLE "Reminder" ADD COLUMN "kind" "ReminderKind" NOT NULL DEFAULT 'RAPPEL';

-- Canal « courrier » pour la mise en demeure remise/envoyée par écrit.
ALTER TYPE "ReminderChannel" ADD VALUE 'COURRIER';

-- Seuil configurable (jours de retard) au-delà duquel une relance devient une mise en demeure.
ALTER TABLE "ReminderRule" ADD COLUMN "formalNoticeThresholdDays" INTEGER NOT NULL DEFAULT 30;
