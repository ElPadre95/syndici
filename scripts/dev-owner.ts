/**
 * Utilitaire de DÉVELOPPEMENT — crée (idempotent) un compte PROPRIÉTAIRE connectable,
 * lié à la Person du MRE multi-lots du seed (id stable). Aucune adhésion : son rôle
 * PROPRIETAIRE dérive de ses rattachements de lot.
 *
 * JAMAIS destiné à la production : refuse de s'exécuter si NODE_ENV === 'production'.
 * Usage : `npm run dev:owner` (après `npm run db:seed`).
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/auth/password';

const EMAIL = 'owner@dev.local';
const PASSWORD = 'dev-owner-2026';
const MRE_OWNER_ID = '5eed0000-0000-4000-8000-000000000003';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('dev-owner est interdit en production.');
  }
  const prisma = new PrismaClient();
  try {
    const owner = await prisma.person.findUnique({ where: { id: MRE_OWNER_ID } });
    if (!owner) {
      throw new Error('Propriétaire MRE introuvable. Lancez le seed (npm run db:seed) d’abord.');
    }
    const attachments = await prisma.lotAttachment.findMany({
      where: { personId: owner.id, role: 'OWNER', endDate: null },
      include: { lot: { select: { reference: true } }, residence: { select: { name: true } } },
    });

    const passwordHash = await hashPassword(PASSWORD);
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      update: { passwordHash },
      create: { email: EMAIL, passwordHash },
    });
    if (owner.authUserId !== user.id) {
      await prisma.person.update({ where: { id: owner.id }, data: { authUserId: user.id } });
    }
    console.log(
      [
        '',
        '  Compte propriétaire de développement prêt :',
        `    e-mail       : ${EMAIL}`,
        `    mot de passe : ${PASSWORD}`,
        '',
        `    propriétaire : ${owner.firstName} ${owner.lastName}`,
        `    lots         : ${attachments.map((a) => `${a.lot.reference} (${a.residence.name})`).join(', ')}`,
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
