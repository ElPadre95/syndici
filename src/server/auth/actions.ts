'use server';

/**
 * Actions serveur pour les écrans d'authentification. Fines enveloppes autour des
 * fonctions déjà testées (verifyInvitation / onboardWithPassword), adossées aux
 * exécuteurs de production. Elles ne renvoient JAMAIS de PII avant activation et ne
 * divulguent pas l'existence des comptes.
 */
import { prismaExecutor, prismaTxRunner } from '@/server/db/sql';
import { verifyInvitation, type InvitationRole } from './invitation';
import { onboardWithPassword, type OnboardFailure } from './onboarding';

export type VerifyState =
  { status: 'valid'; role: InvitationRole } | { status: 'invalid'; reason: string };

export async function verifyInviteAction(code: string): Promise<VerifyState> {
  const res = await verifyInvitation(prismaExecutor(), code);
  if (res.valid) return { status: 'valid', role: res.role };
  return { status: 'invalid', reason: res.reason };
}

export type OnboardState = { status: 'ok' } | { status: 'error'; reason: OnboardFailure };

export async function onboardAction(input: {
  code: string;
  email: string;
  password: string;
}): Promise<OnboardState> {
  const res = await onboardWithPassword(prismaExecutor(), prismaTxRunner(), input);
  return res.ok ? { status: 'ok' } : { status: 'error', reason: res.reason };
}
