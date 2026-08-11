import type { NextAuthConfig } from 'next-auth';

/**
 * Configuration Auth.js « de base », SANS adaptateur ni providers lourds
 * (bcrypt, Prisma) : elle doit rester exécutable sur le runtime EDGE du
 * middleware. Le middleware n'a besoin que de DÉCODER le JWT de session pour
 * savoir si la requête est authentifiée. La configuration complète (adaptateur,
 * providers, callbacks) vit dans src/server/auth/config.ts et n'est utilisée que
 * côté Node (route API + `auth()` des composants serveur).
 */
export const authConfigBase = {
  session: { strategy: 'jwt' },
  trustHost: true,
  providers: [],
} satisfies NextAuthConfig;
