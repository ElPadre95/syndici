/**
 * Rattachements historisés personne ↔ lot (SPEC §9, decisions D13/D14).
 * Permet de répondre à « qui possédait / occupait le lot X à la date D ».
 *
 * Période d'un rattachement : [startDate, endDate] inclusif ; endDate null = actif.
 * La base garantit (index partiels, migration) : au plus UN propriétaire actif,
 * UN locataire actif, UN payeur actif par lot. La cohérence des périodes
 * HISTORIQUES (chevauchements de deux périodes closes du même rôle) est validée
 * ici, en amont d'une insertion.
 */

export type AttachmentRole = 'OWNER' | 'TENANT';

export interface AttachmentPeriod {
  role: AttachmentRole;
  personId: string;
  startDate: Date;
  endDate: Date | null;
  isChargePayer?: boolean;
}

/** Vrai si le rattachement est actif à la date donnée. */
export function isActiveAt(a: AttachmentPeriod, date: Date): boolean {
  const t = date.getTime();
  const start = a.startDate.getTime();
  const end = a.endDate ? a.endDate.getTime() : Number.POSITIVE_INFINITY;
  return start <= t && t <= end;
}

/** Le rattachement d'un rôle donné actif à la date (ou undefined). */
export function attachmentAt(
  attachments: readonly AttachmentPeriod[],
  role: AttachmentRole,
  date: Date,
): AttachmentPeriod | undefined {
  return attachments.find((a) => a.role === role && isActiveAt(a, date));
}

/** Propriétaire du lot à la date. */
export function ownerAt(attachments: readonly AttachmentPeriod[], date: Date) {
  return attachmentAt(attachments, 'OWNER', date);
}

/**
 * Occupant du lot à la date : le locataire s'il existe, sinon le propriétaire
 * (cas du propriétaire-occupant).
 */
export function occupantAt(attachments: readonly AttachmentPeriod[], date: Date) {
  return attachmentAt(attachments, 'TENANT', date) ?? attachmentAt(attachments, 'OWNER', date);
}

/** Redevable des charges actif à la date (par défaut le propriétaire, délégable). */
export function chargePayerAt(attachments: readonly AttachmentPeriod[], date: Date) {
  return attachments.find((a) => a.isChargePayer && isActiveAt(a, date));
}

/** Deux périodes se chevauchent-elles ? (bornes inclusives, null = infini). */
export function periodsOverlap(a: AttachmentPeriod, b: AttachmentPeriod): boolean {
  const aStart = a.startDate.getTime();
  const aEnd = a.endDate ? a.endDate.getTime() : Number.POSITIVE_INFINITY;
  const bStart = b.startDate.getTime();
  const bEnd = b.endDate ? b.endDate.getTime() : Number.POSITIVE_INFINITY;
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Détecte une incohérence : deux rattachements du MÊME rôle dont les périodes se
 * chevauchent (à utiliser avant insertion — la base bloque déjà deux actifs).
 */
export function hasRoleOverlap(attachments: readonly AttachmentPeriod[]): boolean {
  for (let i = 0; i < attachments.length; i++) {
    for (let j = i + 1; j < attachments.length; j++) {
      const a = attachments[i]!;
      const b = attachments[j]!;
      if (a.role === b.role && periodsOverlap(a, b)) return true;
    }
  }
  return false;
}
