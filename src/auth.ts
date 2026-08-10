/**
 * Point d'entrée Auth.js. `auth()` donne la session côté serveur ; `handlers`
 * alimente la route API ; `signIn`/`signOut` sont utilisés par les écrans.
 */
import NextAuth from 'next-auth';
import { authConfig } from '@/server/auth/config';

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
