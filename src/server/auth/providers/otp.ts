/**
 * SEAM OTP SMS / WhatsApp (§1 — « préparer sans refactor »).
 *
 * L'OTP n'est PAS activé dans cette étape. Ce fichier documente et matérialise le
 * point d'extension : un provider OTP se branche exactement comme les autres —
 * il suffira de l'ajouter au tableau de `./index.ts`. La vérification du code
 * réutilisera la même logique isolée que le mot de passe (un module `../otp.ts`
 * testable contre PGlite), et l'envoi passera par un canal (SMS/WhatsApp) derrière
 * une interface `OtpTransport`. Aucune autre partie de la configuration ne changera.
 *
 * Esquisse (désactivée) :
 *
 *   import Credentials from 'next-auth/providers/credentials';
 *   export function otpProvider(transport: OtpTransport): Provider {
 *     return Credentials({
 *       id: 'otp',
 *       credentials: { phone: {}, code: {} },
 *       authorize: async (c) => verifyOtp(prismaExecutor(), transport, c),
 *     });
 *   }
 *
 * export interface OtpTransport { send(phone: string, code: string): Promise<void>; }
 */
export const OTP_PLACEHOLDER = true;
