/**
 * Configuration Auth.js (NextAuth v5) — §1 & §4.
 *
 * - Stratégie de session JWT (imposée par le provider Credentials).
 * - Adaptateur Prisma pour le lien magique (VerificationToken) et les comptes.
 * - Le JWT porte l'IDENTITÉ MÉTIER (`personId`) et le CONTEXTE MULTI-RÉSIDENCES :
 *   la liste des résidences accessibles et la résidence active. Le contexte est
 *   REVALIDÉ à chaque connexion (résidences recalculées) ; le changement de
 *   résidence active passe par `update()` et n'accepte qu'une résidence encore
 *   accessible. Aucune requête métier ne doit se fier au client sans repasser par
 *   `resolveActiveContext` côté serveur.
 */
import type { NextAuthConfig } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { authConfigBase } from '@/auth.config';
import { getBaseClient } from '@/server/db/client';
import { prismaExecutor } from '@/server/db/sql';
import { authProviders } from './providers';
import { resolvePersonIdForUser } from './person-access';
import { listAccessibleResidences } from './context';

export const authConfig: NextAuthConfig = {
  ...authConfigBase,
  adapter: PrismaAdapter(getBaseClient()),
  providers: authProviders(),
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // À la connexion : résoudre la Person liée et le périmètre de résidences.
      if (user?.id) {
        const exec = prismaExecutor();
        const personId = await resolvePersonIdForUser(exec, user.id);
        token.personId = personId ?? undefined;
        const residences = personId ? await listAccessibleResidences(exec, personId) : [];
        token.residences = residences;
        token.activeResidenceId = residences[0];
      }
      // Changement de résidence active (sélecteur) — borné aux résidences accessibles.
      if (
        trigger === 'update' &&
        session &&
        typeof (session as { activeResidenceId?: unknown }).activeResidenceId === 'string'
      ) {
        const target = (session as { activeResidenceId: string }).activeResidenceId;
        if (Array.isArray(token.residences) && token.residences.includes(target)) {
          token.activeResidenceId = target;
        }
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as { personId?: string; activeResidenceId?: string; residences?: string[] };
      if (session.user) session.user.personId = t.personId;
      session.activeResidenceId = t.activeResidenceId;
      session.accessibleResidences = t.residences ?? [];
      return session;
    },
  },
};
