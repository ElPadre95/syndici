/**
 * Provider « lien magique » par e-mail (§1, I5). L'envoi passe par le canal e-mail abstrait
 * (`sendEmail`) : en développement il est seulement JOURNALISÉ (le `LogMailer` n'envoie rien),
 * en production il part via Resend — sans changer la configuration Auth.js. L'URL est fournie
 * par Auth.js (adaptateur Prisma `VerificationToken`). La langue par défaut est le français
 * (l'identité du destinataire n'est pas résolue ici) ; on ne lit jamais la table Person.
 */
import type { Provider } from 'next-auth/providers';
import { sendEmail } from '@/server/mail/mailer';
import { magicLinkEmail } from '@/server/mail/templates';

const DAY = 24 * 60 * 60;

export function magicLinkProvider(): Provider {
  return {
    id: 'magic-link',
    name: 'Lien magique',
    type: 'email',
    from: 'no-reply@syndici.local',
    maxAge: DAY,
    async sendVerificationRequest({ identifier, url }) {
      const email = await magicLinkEmail('fr', url);
      const res = await sendEmail({ to: identifier, ...email });
      if (!res.ok) {
        // On ne divulgue pas l'échec au visiteur (anti-énumération) ; on le trace côté serveur.
        console.error(`[magic-link] échec d'envoi à ${identifier}: ${res.error}`);
      }
    },
    // Renseigné par la configuration NextAuth via l'adaptateur.
    options: {},
  } as Provider;
}
