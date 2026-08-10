/**
 * Augmentation des types Auth.js : on expose l'identité métier (`personId`) et le
 * contexte multi-résidences sur la session et le JWT.
 */
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    activeResidenceId?: string;
    accessibleResidences: string[];
    user: {
      personId?: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    personId?: string;
    activeResidenceId?: string;
    residences?: string[];
  }
}
