-- H1 — Boucle de transparence : une dépense peut DÉCOULER d'un incident.
-- L'incident signalé → l'intervention → la facture, reliés. ON DELETE SET NULL :
-- supprimer un incident n'efface jamais la dépense (écriture comptable).
ALTER TABLE "Expense" ADD COLUMN "incidentId" TEXT;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Expense_incidentId_idx" ON "Expense"("incidentId");
