/**
 * Provider « lien magique » par e-mail (§1). En développement, le transport
 * journalise simplement l'URL (aucun SMTP requis). En production, remplacer le
 * corps de `sendVerificationRequest` par un envoi SMTP / API e-mail — sans changer
 * le reste de la configuration Auth.js. S'appuie sur l'adaptateur Prisma
 * (`VerificationToken`).
 */
import type { Provider } from 'next-auth/providers';

const DAY = 24 * 60 * 60;

export function magicLinkProvider(): Provider {
  return {
    id: 'magic-link',
    name: 'Lien magique',
    type: 'email',
    from: 'no-reply@syndici.local',
    maxAge: DAY,
    async sendVerificationRequest({ identifier, url }) {
      // Transport de développement : à remplacer par un envoi réel en production.
      console.log(`[magic-link] destinataire=${identifier} url=${url}`);
    },
    // Renseigné par la configuration NextAuth via l'adaptateur.
    options: {},
  } as Provider;
}
