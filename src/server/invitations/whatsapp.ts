/**
 * Lien wa.me pré-rempli (A6) — PUR et testable. Le message lui-même vient des
 * catalogues i18n (dans la langue préférée de la personne) ; ici on n'assemble que
 * le lien. WhatsApp est le canal principal au Maroc : aucun envoi e-mail/API.
 */

/** Ne garde que les chiffres du numéro (wa.me veut un numéro international sans « + »). */
export function normalizePhoneForWa(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Construit un lien wa.me avec le message pré-rempli. Sans numéro exploitable, on
 * renvoie un lien de partage (WhatsApp demandera le destinataire).
 */
export function whatsappHref(phone: string | null | undefined, message: string): string {
  const num = normalizePhoneForWa(phone);
  const base = num ? `https://wa.me/${num}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message)}`;
}
