/**
 * Demandes de contact de la vitrine (J1) — couche données. Table GLOBALE (aucun
 * `residenceId`), donc `getBaseClient()` et NON l'extension multi-résidence : un visiteur
 * anonyme n'a pas encore de copropriété. Persistée AVANT tout e-mail (voir actions.ts) :
 * un lead ne doit jamais reposer sur le seul envoi d'un message.
 *
 * Tout l'accès Prisma aux demandes passe par ce module (aucun appel Prisma hors de
 * src/server/), y compris la limitation anti-abus (comptage par IP sur une fenêtre).
 */
import type { ContactRole, Prisma } from '@prisma/client';
import { getBaseClient } from '@/server/db/client';

// Rôles déclarables : définis dans un module pur (roles.ts) pour rester importables côté client.
export { CONTACT_ROLES, isContactRole } from './roles';

export interface NewContactRequest {
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  residences: number | null;
  lots: number | null;
  role: ContactRole;
  message: string | null;
  locale: string | null;
  ip: string | null;
  userAgent: string | null;
}

export async function createContactRequest(input: NewContactRequest): Promise<{ id: string }> {
  const row = await getBaseClient().contactRequest.create({
    data: input,
    select: { id: true },
  });
  return row;
}

/**
 * Nombre de demandes issues d'une même IP depuis `since`. Sert de limitation anti-abus
 * SANS friction pour le visiteur (pas de captcha) : au-delà d'un seuil sur une courte
 * fenêtre, l'action refuse en silence. Une IP inconnue (null) n'est jamais comptée.
 */
export async function countRecentByIp(ip: string, since: Date): Promise<number> {
  return getBaseClient().contactRequest.count({
    where: { ip, createdAt: { gte: since } },
  });
}

export interface ContactRequestRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  residences: number | null;
  lots: number | null;
  role: ContactRole;
  message: string | null;
  locale: string | null;
  handled: boolean;
  handledAt: Date | null;
  createdAt: Date;
}

const ROW_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  city: true,
  residences: true,
  lots: true,
  role: true,
  message: true,
  locale: true,
  handled: true,
  handledAt: true,
  createdAt: true,
} satisfies Prisma.ContactRequestSelect;

/** Liste pour l'écran staff : non traitées d'abord, puis les plus récentes. */
export async function listContactRequests(): Promise<ContactRequestRow[]> {
  return getBaseClient().contactRequest.findMany({
    select: ROW_SELECT,
    orderBy: [{ handled: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
}

export async function countPendingContactRequests(): Promise<number> {
  return getBaseClient().contactRequest.count({ where: { handled: false } });
}

/** Marque une demande traitée / non traitée (idempotent). */
export async function setContactRequestHandled(id: string, handled: boolean): Promise<void> {
  await getBaseClient().contactRequest.update({
    where: { id },
    data: { handled, handledAt: handled ? new Date() : null },
  });
}
