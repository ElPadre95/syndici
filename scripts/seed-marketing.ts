/**
 * Jeu de données pour les CAPTURES MARKETING (J1) — distinct du seed de démonstration.
 *
 * À lancer APRÈS le seed de démo, sur la base de DEV uniquement (jamais en production). Il
 * transforme les données en place, SANS AUCUN nominatif : résidence neutre, noms de personnes
 * abrégés (« Sara T. »), e-mails en @syndici.com, fournisseurs génériques crédibles pour le
 * marché marocain. Il crée deux comptes de capture (@syndici.com) — un syndic, un propriétaire.
 *
 *   npm run db:seed && MARKETING_PASSWORD=… tsx scripts/seed-marketing.ts
 *
 * Restaurer la démo ensuite : `npm run db:seed && npm run dev:account && npm run dev:owner`.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/auth/password';

if (process.env.NODE_ENV === 'production') {
  console.error('Refus : seed-marketing ne doit jamais tourner en production.');
  process.exit(1);
}

const prisma = new PrismaClient();

const RESIDENCE_NAME = 'Résidence Yasmine';
const MRE_OWNER_ID = '5eed0000-0000-4000-8000-000000000003';
const PASSWORD = process.env.MARKETING_PASSWORD ?? 'marketing-capture-2026';

// Fournisseurs : on remplace les entreprises RÉELLES par des équivalents génériques crédibles.
const SUPPLIER_MAP: Record<string, string> = {
  'Wafa Assurance': 'Atlas Assurances',
  RADEEMA: 'Régie Eau & Électricité',
  RADEEC: "Régie de l'Eau",
  'Otis Maroc': 'Ascenseurs du Maroc',
  SecuGuard: 'Atlas Sécurité',
  'Cabinet Al Amane': 'Cabinet Gestion Pro',
};

const initial = (s: string) => {
  const c = Array.from(s.trim())[0];
  return c ? `${c.toUpperCase()}.` : s;
};
const swapDomain = (email: string) => `${email.split('@')[0]}@syndici.com`;
const neutralize = (s: string | null | undefined) =>
  (s ?? '').replaceAll('Al Firdaous', 'Yasmine').replaceAll('Firdaous', 'Yasmine');

async function main(): Promise<void> {
  // 1) Résidence + organisation neutres.
  await prisma.residence.updateMany({ data: { name: RESIDENCE_NAME } });
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  for (const o of orgs) {
    await prisma.organization.update({
      where: { id: o.id },
      data: { name: SUPPLIER_MAP[o.name] ?? 'Cabinet Gestion Pro' },
    });
  }

  // 2) Personnes : prénom entier + initiale du nom, e-mails @syndici.com. Zéro nominatif.
  const people = await prisma.person.findMany({ select: { id: true, lastName: true, email: true } });
  for (const p of people) {
    await prisma.person.update({
      where: { id: p.id },
      data: {
        lastName: initial(p.lastName),
        email: p.email ? swapDomain(p.email) : p.email,
      },
    });
  }

  // 3) Fournisseurs génériques (dépenses + contrats).
  for (const [real, generic] of Object.entries(SUPPLIER_MAP)) {
    await prisma.expense.updateMany({ where: { supplierName: real }, data: { supplierName: generic } });
    await prisma.supplierContract.updateMany({
      where: { supplierName: real },
      data: { supplierName: generic },
    });
  }

  // 4) Textes mentionnant l'ancienne résidence (actualités, documents).
  for (const a of await prisma.announcement.findMany({ select: { id: true, title: true, body: true } })) {
    await prisma.announcement.update({
      where: { id: a.id },
      data: { title: neutralize(a.title), body: neutralize(a.body) },
    });
  }
  for (const d of await prisma.document.findMany({ select: { id: true, name: true } })) {
    await prisma.document.update({ where: { id: d.id }, data: { name: neutralize(d.name) } });
  }

  // 5) Comptes de capture @syndici.com — un syndic (OWNER_ADMIN), un propriétaire (le MRE).
  const org = orgs[0];
  if (!org) throw new Error('Aucune organisation trouvée.');
  const passwordHash = await hashPassword(PASSWORD);

  const syndicPerson = await prisma.person.create({
    data: { firstName: 'Karim', lastName: 'B.', email: 'syndic@syndici.com', preferredLocale: 'fr' },
  });
  await prisma.membership.create({
    data: { organizationId: org.id, personId: syndicPerson.id, role: 'OWNER_ADMIN', status: 'ACTIVE' },
  });
  const syndicUser = await prisma.user.upsert({
    where: { email: 'syndic@syndici.com' },
    update: { passwordHash },
    create: { email: 'syndic@syndici.com', passwordHash },
  });
  await prisma.person.update({ where: { id: syndicPerson.id }, data: { authUserId: syndicUser.id } });

  const ownerUser = await prisma.user.upsert({
    where: { email: 'owner@syndici.com' },
    update: { passwordHash },
    create: { email: 'owner@syndici.com', passwordHash },
  });
  const mre = await prisma.person.findFirst({ where: { id: MRE_OWNER_ID }, select: { id: true } });
  if (mre) {
    await prisma.person.update({ where: { id: mre.id }, data: { authUserId: ownerUser.id } });
  }

  console.log('✔ Données marketing prêtes.');
  console.log('  syndic@syndici.com / owner@syndici.com  (mot de passe fourni par MARKETING_PASSWORD).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
