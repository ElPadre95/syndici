/**
 * Validation du formulaire « ajouter une personne à un lot » (A5) — PURE, testable.
 * Deux modes : rattacher une personne EXISTANTE (dédoublonnage, cas MRE) ou en créer
 * une nouvelle. Erreurs par champ sous forme de codes (rendu i18n côté UI).
 */
export type AttachRole = 'OWNER' | 'TENANT';
const ROLES: readonly AttachRole[] = ['OWNER', 'TENANT'];
const LOCALES = ['fr', 'ar'];

export interface AttachFormState {
  errors?: Record<string, string>;
  formError?: string;
}

export interface AttachFormRaw {
  existingPersonId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  preferredLocale: string;
  role: string;
  delegate: string; // 'on' | ''
  startDate: string; // yyyy-mm-dd
}

export interface AttachDraft {
  existingPersonId: string | null;
  person: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    nationality: string | null;
    preferredLocale: string;
  } | null;
  role: AttachRole;
  delegate: boolean;
  startDate: Date;
}

export type AttachValidation =
  { ok: true; value: AttachDraft } | { ok: false; errors: Record<string, string> };

export function validateAttachInput(raw: AttachFormRaw): AttachValidation {
  const errors: Record<string, string> = {};

  const role = raw.role as AttachRole;
  if (!ROLES.includes(role)) errors.role = 'invalidRole';

  const startTrim = raw.startDate.trim();
  const startDate = new Date(startTrim);
  if (startTrim === '' || Number.isNaN(startDate.getTime())) errors.startDate = 'required';

  const existingPersonId = raw.existingPersonId.trim() || null;

  let person: AttachDraft['person'] = null;
  if (!existingPersonId) {
    const firstName = raw.firstName.trim();
    const lastName = raw.lastName.trim();
    if (!firstName) errors.firstName = 'required';
    if (!lastName) errors.lastName = 'required';
    const email = raw.email.trim();
    if (email !== '' && !email.includes('@')) errors.email = 'invalidEmail';
    const locale = raw.preferredLocale.trim();
    if (!LOCALES.includes(locale)) errors.preferredLocale = 'invalidLocale';
    if (!errors.firstName && !errors.lastName && !errors.email && !errors.preferredLocale) {
      person = {
        firstName,
        lastName,
        email: email || null,
        phone: raw.phone.trim() || null,
        nationality: raw.nationality.trim() || null,
        preferredLocale: locale,
      };
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      existingPersonId,
      person,
      role,
      delegate: role === 'TENANT' && raw.delegate === 'on',
      startDate,
    },
  };
}
