/**
 * Utilitaire de DÉVELOPPEMENT — crée (idempotent) un compte syndic connectable,
 * lié à une Person membre de l'organisation qui détient le mandat actif sur la
 * résidence du seed. Affiche l'e-mail et le mot de passe.
 *
 * JAMAIS destiné à la production : refuse de s'exécuter si NODE_ENV === 'production'.
 * Usage : `npm run dev:account`
 *
 * (Outil de tooling, hors `src/` : comme prisma/seed.ts, il peut utiliser Prisma
 * directement. Le hachage réutilise la logique applicative `hashPassword`.)
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/auth/password';

const EMAIL = 'syndic@dev.local';
const PASSWORD = 'dev-syndic-2026';
// Id STABLE de la Person dev : conservé d'un reseed à l'autre pour que le jeton de session
// (personId) reste valide (rôle et résidence recalculés à chaque requête). Sans lui, chaque
// reseed recréait la personne avec un nouvel id → session périmée → coquille vide.
const DEV_PERSON_ID = '5eed0000-0000-4000-8000-000000000002';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('dev-account est interdit en production.');
  }
  const prisma = new PrismaClient();
  try {
    // 1. Résidence du seed + son mandat actif → organisation.
    const mandate = await prisma.mandate.findFirst({
      where: { status: 'ACTIVE' },
      include: { residence: true, organization: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!mandate) {
      throw new Error('Aucun mandat actif trouvé. Lancez le seed (npm run db:seed) d’abord.');
    }
    const org = mandate.organization;

    // 2. Person « Dev Syndic » dans cette organisation, avec un rôle OWNER_ADMIN actif.
    let person = await prisma.person.findFirst({ where: { email: EMAIL } });
    if (!person) {
      person = await prisma.person.create({
        data: {
          id: DEV_PERSON_ID,
          firstName: 'Dev',
          lastName: 'Syndic',
          email: EMAIL,
          preferredLocale: 'fr',
        },
      });
    }
    const membership = await prisma.membership.findUnique({
      where: { organizationId_personId: { organizationId: org.id, personId: person.id } },
    });
    if (!membership) {
      await prisma.membership.create({
        data: {
          organizationId: org.id,
          personId: person.id,
          role: 'OWNER_ADMIN',
          status: 'ACTIVE',
        },
      });
    } else if (membership.role !== 'OWNER_ADMIN' || membership.status !== 'ACTIVE') {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { role: 'OWNER_ADMIN', status: 'ACTIVE' },
      });
    }

    // 3. Compte (User) avec mot de passe — créé ou mot de passe réinitialisé (dev seulement).
    const passwordHash = await hashPassword(PASSWORD);
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      update: { passwordHash },
      create: { email: EMAIL, passwordHash },
    });

    // 4. Lien Person ↔ compte (une seule fois ; on répare si déjà posé sur ce compte).
    if (person.authUserId !== user.id) {
      await prisma.person.update({ where: { id: person.id }, data: { authUserId: user.id } });
    }
    console.log(
      [
        '',
        '  Compte syndic de développement prêt :',
        `    e-mail       : ${EMAIL}`,
        `    mot de passe : ${PASSWORD}`,
        '',
        `    organisation : ${org.name}`,
        `    résidence    : ${mandate.residence.name} (${mandate.residence.city ?? '—'})`,
        '',
        '  Connexion : http://localhost:3000/fr/sign-in',
        '',
      ].join('\n'),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
