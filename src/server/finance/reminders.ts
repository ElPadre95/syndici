/**
 * Relances WhatsApp (E2). Le canal est un lien `wa.me` pré-rempli : le gérant ouvre le
 * message dans WhatsApp et appuie sur envoyer. Pas d'API Meta, pas de coût. On PERSISTE
 * le texte réellement préparé : c'est la preuve en cas de litige et l'alimentation de la
 * condition anti-harcèlement (§7.1). ⚠ La trace est une INTENTION d'envoi (le gérant peut
 * ouvrir le lien sans envoyer) — jamais une certitude de réception.
 *
 * Écriture executor-based (SQL brut typé) → testable PGlite ET Postgres réel.
 */
import type { TxRunner } from '@/server/db/sql';

const INSERT_REMINDER = `
  INSERT INTO "Reminder"
    (id,"residenceId","lotId","recipientPersonId","reminderRuleId",channel,message,"sentAt","sentByPersonId")
  VALUES (gen_random_uuid(),$1,$2,$3,$4,$5::"ReminderChannel",$6,now(),$7)
  RETURNING id`;

export interface RecordReminderInput {
  residenceId: string;
  lotId: string;
  recipientPersonId: string | null;
  reminderRuleId: string | null;
  message: string;
  sentByPersonId: string;
}

/** Trace une relance (intention d'envoi) : à qui, quand, quelle règle, quel canal, quel texte. */
export async function writeReminder(runner: TxRunner, input: RecordReminderInput): Promise<string> {
  return runner.transaction(async (tx) => {
    const rows = await tx.query<{ id: string }>(INSERT_REMINDER, [
      input.residenceId,
      input.lotId,
      input.recipientPersonId,
      input.reminderRuleId,
      'WHATSAPP',
      input.message,
      input.sentByPersonId,
    ]);
    return rows[0]!.id;
  });
}

/**
 * Numéro au format `wa.me` : chiffres uniquement (indicatif pays compris). `null` si
 * aucun téléphone — le lien s'ouvrira alors sans destinataire (le gérant choisit le contact).
 */
export function waPhoneDigits(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

/** Lien `wa.me` pré-rempli avec le message (encodé). Destinataire optionnel. */
export function waLink(phoneDigits: string | null, message: string): string {
  const base = phoneDigits ? `https://wa.me/${phoneDigits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message)}`;
}
