/**
 * Provider « e-mail + mot de passe » (§1). Fin adaptateur autour de la logique
 * testable de `../password.ts`. Isolé dans son propre fichier pour pouvoir en
 * ajouter d'autres (magic link, OTP) sans y toucher.
 */
import Credentials from 'next-auth/providers/credentials';
import type { Provider } from 'next-auth/providers';
import { prismaExecutor } from '@/server/db/sql';
import { authenticatePassword } from '../password';

export function passwordProvider(): Provider {
  return Credentials({
    id: 'password',
    name: 'E-mail et mot de passe',
    credentials: {
      email: { label: 'E-mail', type: 'email' },
      password: { label: 'Mot de passe', type: 'password' },
    },
    authorize: async (credentials) => {
      const email = typeof credentials?.email === 'string' ? credentials.email : '';
      const password = typeof credentials?.password === 'string' ? credentials.password : '';
      if (!email || !password) return null;
      const user = await authenticatePassword(prismaExecutor(), email, password);
      return user ? { id: user.id, email: user.email } : null;
    },
  });
}
