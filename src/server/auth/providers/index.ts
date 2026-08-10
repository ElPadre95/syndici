/**
 * Assemblage des providers d'authentification. Ajouter un provider (OTP demain)
 * = ajouter une entrée ici, rien d'autre (§1 : isoler les providers).
 */
import type { Provider } from 'next-auth/providers';
import { passwordProvider } from './password';
import { magicLinkProvider } from './magic-link';
// import { otpProvider } from './otp'; // futur : SMS / WhatsApp (cf. otp.ts)

export function authProviders(): Provider[] {
  return [passwordProvider(), magicLinkProvider()];
}
