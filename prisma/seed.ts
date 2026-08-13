/**
 * Seed réaliste (decision D22). Une résidence MIXTE de 24 lots :
 *  - 9 lots à propriétaire résidant à l'étranger (France / Belgique / Pays-Bas) ;
 *  - plusieurs lots loués avec un LOCATAIRE distinct du propriétaire (dont un où
 *    le paiement des charges est délégué au locataire) ;
 *  - des impayés à des stades variés (payé / partiel / en retard / à venir) ;
 *  - des paiements en espèces avec reçus numérotés séquentiellement ;
 *  - des dépenses avec justificatif (référence de fichier, jamais de base64) ;
 *  - des contrats à échéances proches (dont un expiré et un sous 30 jours).
 *
 * Toute la logique (statut, reçus) reste dérivée/allouée par la couche serveur.
 */
import { PrismaClient } from '@prisma/client';
import { createReceipt, createExpense } from '../src/server/finance/numbering';
import { distributeQuoteParts } from '../src/server/lots/quote-part';
import { disconnectBase } from '../src/server/db/client';
import { hashPassword } from '../src/server/auth/password';

const prisma = new PrismaClient();

const dh = (dirhams: number): number => dirhams * 100; // -> centimes (Int)
const CHARGE_APPT = dh(650);
const CHARGE_VILLA = dh(1200);

const now = new Date();
const YEAR = now.getFullYear();
// 1er du mois, décalé de `offset` mois par rapport au mois courant.
const monthStart = (offset: number): Date => new Date(Date.UTC(YEAR, now.getMonth() + offset, 1));

// Les 4 combinaisons d'états à démontrer (jeu de démonstration) :
//   SETTLED            → soldé
//   PARTIAL_OVERDUE    → partiel ET échu
//   UNSETTLED_OVERDUE  → non réglé ET échu
//   UNSETTLED_UPCOMING → non réglé AVANT échéance
type Profile = 'SETTLED' | 'PARTIAL_OVERDUE' | 'UNSETTLED_OVERDUE' | 'UNSETTLED_UPCOMING';
type OccupancyKind = 'OWNER_OCCUPIED' | 'RENTED' | 'VACANT';

interface LotSpec {
  reference: string;
  villa: boolean;
  owner?: {
    first: string;
    last: string;
    nationality: string;
    locale: 'fr' | 'nl' | 'ar';
    abroad: boolean;
  };
  tenant?: { first: string; last: string; nationality: string; locale: 'fr' | 'ar' };
  tenantPaysCharges?: boolean;
  profile?: Profile; // absent = lot vacant en dur (aucun appel de charges)
  occupancy: OccupancyKind;
}

// 18 appartements (A/B/C 1..6) + 6 villas (V1..V6). 9 propriétaires à l'étranger.
function buildLotSpecs(): LotSpec[] {
  const specs: LotSpec[] = [];
  const foreign = [
    { first: 'Sara', last: 'Tahiri', nationality: 'France', locale: 'fr' as const },
    { first: 'Youssef', last: 'Chraibi', nationality: 'Pays-Bas', locale: 'nl' as const },
    { first: 'Amine', last: 'Moussaoui', nationality: 'Belgique', locale: 'fr' as const },
    { first: 'Jan', last: 'Van der Berg', nationality: 'Pays-Bas', locale: 'nl' as const },
    { first: 'Leïla', last: 'Berrada', nationality: 'France', locale: 'fr' as const },
    { first: 'Karim', last: 'El Idrissi', nationality: 'Belgique', locale: 'fr' as const },
    { first: 'Nadia', last: 'Bennani', nationality: 'France', locale: 'fr' as const },
    { first: 'Sofie', last: 'Janssens', nationality: 'Belgique', locale: 'fr' as const },
    { first: 'Fatima', last: 'Zahra', nationality: 'Pays-Bas', locale: 'nl' as const },
  ];
  const local = [
    'Benali Karim',
    'Amrani Fatima',
    'Ziani Mohammed',
    'El Fassi Omar',
    'Alaoui Hafsa',
    'Bennis Rachid',
    'Cherkaoui Salma',
    'Daoudi Hicham',
    'Fassi Imane',
    'Guessous Anas',
    'Haddad Meryem',
    'Idrissi Yassine',
    'Kabbaj Nawal',
    'Lahlou Reda',
    'Mansouri Zineb',
  ];
  const refs: Array<{ ref: string; villa: boolean }> = [];
  for (const block of ['A', 'B', 'C'])
    for (let n = 1; n <= 6; n++) refs.push({ ref: `${block}${n}`, villa: false });
  for (let n = 1; n <= 6; n++) refs.push({ ref: `V${n}`, villa: true });

  const profiles: Profile[] = [
    'SETTLED',
    'PARTIAL_OVERDUE',
    'UNSETTLED_OVERDUE',
    'UNSETTLED_UPCOMING',
  ];
  let localIdx = 0;
  refs.forEach((r, i) => {
    const isForeign = i < foreign.length;
    const ownerBase = isForeign
      ? foreign[i]!
      : (() => {
          const [last, first] = local[localIdx++ % local.length]!.split(' ');
          return {
            first: first ?? 'Résident',
            last: last ?? 'Inconnu',
            nationality: 'Maroc',
            locale: 'fr' as const,
          };
        })();
    // Loue 1 lot étranger sur 2 (propriétaire absent -> locataire occupant).
    const rented = isForeign && i % 2 === 1;
    // Occupation : loué s'il y a un locataire ; sinon un propriétaire à l'étranger
    // laisse un bien VIDE (résidence secondaire MRE), un local l'occupe lui-même.
    const occupancy: OccupancyKind = rented ? 'RENTED' : isForeign ? 'VACANT' : 'OWNER_OCCUPIED';
    specs.push({
      reference: r.ref,
      villa: r.villa,
      owner: { ...ownerBase, abroad: isForeign },
      tenant: rented
        ? {
            first: ['Omar', 'Hind', 'Rida', 'Salma'][i % 4]!,
            last: 'Locataire',
            nationality: 'Maroc',
            locale: 'fr',
          }
        : undefined,
      tenantPaysCharges: rented && i === 3, // un lot délègue le paiement au locataire
      profile: profiles[i % profiles.length]!,
      occupancy,
    });
  });
  // Lot VACANT en dur (résidence secondaire vide, sans occupant ni appel de charges).
  specs.push({ reference: 'A7', villa: false, occupancy: 'VACANT' });
  return specs;
}

async function main() {
  // Repartir d'une base propre (ordre inverse des dépendances).
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.invitationCode.deleteMany(),
    prisma.reminder.deleteMany(),
    prisma.reminderRule.deleteMany(),
    prisma.ballot.deleteMany(),
    prisma.voteOption.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.vote.deleteMany(),
    prisma.document.deleteMany(),
    prisma.incidentUpdate.deleteMany(),
    prisma.incident.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.expenseCategory.deleteMany(),
    prisma.fileAsset.deleteMany(),
    prisma.receipt.deleteMany(),
    prisma.paymentAllocation.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.chargeCall.deleteMany(),
    prisma.numberSequence.deleteMany(),
    prisma.settlementAccount.deleteMany(),
    prisma.lotAttachment.deleteMany(),
    prisma.lot.deleteMany(),
    prisma.mandate.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.residence.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.person.deleteMany(),
  ]);

  // Organisation + gérant + mandat
  const org = await prisma.organization.create({
    data: { name: 'Cabinet Al Amane', kind: 'COMPANY' },
  });
  const gerant = await prisma.person.create({
    data: {
      firstName: 'Mohammed',
      lastName: 'Karimi',
      email: 'm.karimi@alamane.ma',
      preferredLocale: 'fr',
    },
  });
  await prisma.membership.create({
    data: { organizationId: org.id, personId: gerant.id, role: 'MANAGER' },
  });

  const residence = await prisma.residence.create({
    data: {
      name: 'Résidence Al Firdaous',
      address: 'Bd Zerktouni',
      city: 'Casablanca',
      type: 'MIXTE',
      plan: 'PRO',
      reportedBalanceMinor: dh(24850),
      defaultChargeApptMinor: CHARGE_APPT,
      defaultChargeVillaMinor: CHARGE_VILLA,
      dueDayOfMonth: 1,
    },
  });
  await prisma.mandate.create({
    data: {
      organizationId: org.id,
      residenceId: residence.id,
      status: 'ACTIVE',
      startDate: monthStart(-12),
    },
  });

  // Comptes de règlement : encaissement manuel (résidence) + prestataire en attente (org).
  await prisma.settlementAccount.create({
    data: { residenceId: residence.id, provider: 'MANUAL', status: 'ACTIVE' },
  });
  await prisma.settlementAccount.create({
    data: { organizationId: org.id, provider: 'CMI', merchantId: 'CMI-PENDING', status: 'PENDING' },
  });

  // Règle de relance versionnée (défauts = valeurs du prototype)
  await prisma.reminderRule.create({ data: { residenceId: residence.id, version: 1 } });

  // Catégories de dépenses (union immeuble + villa pour une résidence mixte)
  const categories = [
    'Nettoyage',
    'Électricité',
    'Eau commune',
    'Maintenance',
    'Ascenseur',
    'Assurance',
    'Travaux',
    'Piscine commune',
    'Jardins / espaces verts',
    'Gardiennage',
    'Éclairage public',
    'Voirie / routes',
    'Arrosage',
    'Ramassage déchets',
    'Autre',
  ];
  const catByLabel = new Map<string, string>();
  for (let i = 0; i < categories.length; i++) {
    const c = await prisma.expenseCategory.create({
      data: { residenceId: residence.id, label: categories[i]!, sortOrder: i },
    });
    catByLabel.set(categories[i]!, c.id);
  }

  // Lots + rattachements historisés + charges + paiements + reçus
  const specs = buildLotSpecs();
  const quotas = distributeQuoteParts(specs.length); // total = 1000 millièmes
  let paidCount = 0;
  let partialCount = 0;
  let lateCount = 0;
  let cashCount = 0;

  for (const [lotIndex, spec] of specs.entries()) {
    const lot = await prisma.lot.create({
      data: {
        residenceId: residence.id,
        reference: spec.reference,
        type: spec.villa ? 'VILLA' : 'APPARTEMENT',
        occupancyMode: spec.occupancy,
        quotePart: quotas[lotIndex] ?? 1,
        monthlyChargeMinor: spec.villa ? CHARGE_VILLA : CHARGE_APPT,
      },
    });

    // Lot vacant en dur : aucun occupant, aucun appel de charges.
    if (!spec.owner) continue;

    const owner = await prisma.person.create({
      data: {
        firstName: spec.owner.first,
        lastName: spec.owner.last,
        nationality: spec.owner.nationality,
        preferredLocale: spec.owner.locale,
        email:
          `${spec.owner.first}.${spec.owner.last}`.toLowerCase().replace(/[^a-z]/g, '') +
          '@example.com',
        phone: spec.owner.abroad ? '+33 6 12 34 56 78' : '+212 6 61 00 00 00',
      },
    });
    await prisma.lotAttachment.create({
      data: {
        residenceId: residence.id,
        lotId: lot.id,
        personId: owner.id,
        role: 'OWNER',
        isChargePayer: !spec.tenantPaysCharges,
        startDate: monthStart(-24),
      },
    });

    let payerPersonId = owner.id;
    if (spec.tenant) {
      const tenant = await prisma.person.create({
        data: {
          firstName: spec.tenant.first,
          lastName: spec.tenant.last,
          nationality: spec.tenant.nationality,
          preferredLocale: spec.tenant.locale,
        },
      });
      await prisma.lotAttachment.create({
        data: {
          residenceId: residence.id,
          lotId: lot.id,
          personId: tenant.id,
          role: 'TENANT',
          isChargePayer: Boolean(spec.tenantPaysCharges),
          startDate: monthStart(-6),
        },
      });
      if (spec.tenantPaysCharges) payerPersonId = tenant.id;
    }

    const amount = spec.villa ? CHARGE_VILLA : CHARGE_APPT;
    // Appels de charges : passés (M-2..M) sauf le profil « avant échéance » qui n'a
    // qu'un appel FUTUR (M+1).
    const offsets = spec.profile === 'UNSETTLED_UPCOMING' ? [1] : [-2, -1, 0];
    for (const offset of offsets) {
      const due = monthStart(offset);
      const call = await prisma.chargeCall.create({
        data: {
          residenceId: residence.id,
          lotId: lot.id,
          periodYear: due.getUTCFullYear(),
          periodMonth: due.getUTCMonth() + 1,
          dueDate: due,
          amountMinor: amount,
        },
      });

      // Montant réglé selon le profil.
      let payAmount = 0;
      if (spec.profile === 'SETTLED') payAmount = amount;
      else if (spec.profile === 'PARTIAL_OVERDUE') {
        if (offset === -2)
          payAmount = amount; // ancien appel soldé (avec reçu)
        else if (offset === -1) payAmount = Math.round(amount / 2); // partiel
      }
      // UNSETTLED_OVERDUE / UNSETTLED_UPCOMING → aucun paiement.

      if (payAmount > 0) {
        const full = payAmount === amount;
        // Aucun paiement par carte (tranche B) : espèces en priorité, virement sinon.
        const method = full && offset === -2 ? 'ESPECES' : full ? 'VIREMENT' : 'ESPECES';
        if (method === 'ESPECES') cashCount++;
        const payment = await prisma.payment.create({
          data: {
            residenceId: residence.id,
            lotId: lot.id,
            payerPersonId,
            recordedByPersonId: method === 'ESPECES' ? gerant.id : null,
            method,
            amountMinor: payAmount,
            receivedAt: due,
            note: method === 'ESPECES' ? 'Reçu en main propre' : null,
          },
        });
        await prisma.paymentAllocation.create({
          data: {
            residenceId: residence.id,
            paymentId: payment.id,
            chargeCallId: call.id,
            amountMinor: payAmount,
          },
        });
        // Reçu (numéro séquentiel, transaction) uniquement pour un paiement complet.
        if (full) {
          await createReceipt({
            residenceId: residence.id,
            exercice: YEAR,
            paymentId: payment.id,
            lotId: lot.id,
            amountMinor: payAmount,
          });
        }
      }
    }
    if (spec.profile === 'SETTLED') paidCount++;
    else if (spec.profile === 'PARTIAL_OVERDUE') partialCount++;
    else if (spec.profile === 'UNSETTLED_OVERDUE' || spec.profile === 'UNSETTLED_UPCOMING')
      lateCount++;
  }

  // Un paiement ANNULÉ pour la démo (B2) : annulation par écriture inverse. On prend un
  // virement soldé et on l'annule (le lot redevient impayé par dérivation) — l'original
  // n'est jamais supprimé.
  const toCancel = await prisma.payment.findFirst({
    where: { residenceId: residence.id, method: 'VIREMENT', amountMinor: { gt: 0 } },
    orderBy: { receivedAt: 'desc' },
    include: { allocations: true },
  });
  if (toCancel) {
    const rev = await prisma.payment.create({
      data: {
        residenceId: residence.id,
        lotId: toCancel.lotId,
        payerPersonId: toCancel.payerPersonId,
        recordedByPersonId: gerant.id,
        method: toCancel.method,
        amountMinor: -toCancel.amountMinor,
        receivedAt: toCancel.receivedAt,
        note: 'Virement rejeté',
        reversesPaymentId: toCancel.id,
      },
    });
    for (const a of toCancel.allocations) {
      await prisma.paymentAllocation.create({
        data: {
          residenceId: residence.id,
          paymentId: rev.id,
          chargeCallId: a.chargeCallId,
          amountMinor: -a.amountMinor,
        },
      });
    }
    await prisma.auditLog.create({
      data: {
        residenceId: residence.id,
        actorPersonId: gerant.id,
        action: 'payment.reverse',
        entityType: 'Payment',
        entityId: rev.id,
        after: { reverses: toCancel.id, reason: 'Virement rejeté' },
      },
    });
  }

  // Dépenses avec justificatif (référence de fichier)
  const expenseData = [
    { cat: 'Nettoyage', desc: 'Nettoyage mensuel — NetPro', amount: dh(3200), offset: -1 },
    { cat: 'Électricité', desc: 'Facture RADEEMA', amount: dh(1840), offset: -1 },
    { cat: 'Piscine commune', desc: 'Traitement de l’eau — AquaPro', amount: dh(2400), offset: 0 },
    {
      cat: 'Jardins / espaces verts',
      desc: 'Taille des haies — GreenCare',
      amount: dh(1800),
      offset: 0,
    },
    { cat: 'Assurance', desc: 'Assurance immeuble (acompte)', amount: dh(1000), offset: -2 },
  ];
  for (const e of expenseData) {
    const file = await prisma.fileAsset.create({
      data: {
        residenceId: residence.id,
        bucket: 'justificatifs',
        storageKey: `justificatifs/${e.cat.toLowerCase().replace(/[^a-z]/g, '')}-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        originalName: 'facture.jpg',
      },
    });
    await createExpense({
      residenceId: residence.id,
      exercice: YEAR,
      categoryId: catByLabel.get(e.cat) ?? null,
      description: e.desc,
      amountMinor: e.amount,
      spentOn: monthStart(e.offset),
      justificatifId: file.id,
    });
  }

  // Contrats à échéances variées (par rapport à la date réelle)
  const inDays = (d: number) => new Date(now.getTime() + d * 24 * 3600 * 1000);
  await prisma.supplierContract.createMany({
    data: [
      {
        residenceId: residence.id,
        name: 'Assurance immeuble',
        supplierName: 'Wafa Assurance',
        amountMinor: dh(12000),
        endDate: inDays(20),
        frequency: 'ANNUEL',
      },
      {
        residenceId: residence.id,
        name: 'Entretien ascenseur',
        supplierName: 'Otis Maroc',
        amountMinor: dh(4800),
        endDate: inDays(8),
        frequency: 'ANNUEL',
      },
      {
        residenceId: residence.id,
        name: 'Gardiennage',
        supplierName: 'SecuGuard',
        amountMinor: dh(6000),
        endDate: inDays(-5),
        frequency: 'MENSUEL',
      },
      {
        residenceId: residence.id,
        name: 'Nettoyage',
        supplierName: 'NetPro Services',
        amountMinor: dh(3200),
        endDate: inDays(120),
        frequency: 'MENSUEL',
      },
    ],
  });

  // Un incident avec fil de suivi
  const lotB2 = await prisma.lot.findFirst({
    where: { residenceId: residence.id, reference: 'B2' },
  });
  const incident = await prisma.incident.create({
    data: {
      residenceId: residence.id,
      lotId: lotB2?.id ?? null,
      category: 'Fuite d’eau',
      location: 'Couloir 3ème étage',
      description: 'Fuite au plafond depuis hier soir.',
      urgency: 'IMPORTANTE',
      status: 'EN_COURS',
    },
  });
  await prisma.incidentUpdate.create({
    data: {
      residenceId: residence.id,
      incidentId: incident.id,
      authorPersonId: gerant.id,
      kind: 'STATUS_CHANGE',
      oldStatus: 'NOUVEAU',
      newStatus: 'EN_COURS',
      message: 'Technicien contacté, intervention prévue.',
    },
  });

  // Actualités typées
  await prisma.announcement.createMany({
    data: [
      {
        residenceId: residence.id,
        type: 'URGENT',
        title: 'Panne ascenseur',
        body: 'Technicien prévu demain matin.',
        audience: 'ALL',
        publishedByPersonId: gerant.id,
      },
      {
        residenceId: residence.id,
        type: 'REUNION',
        title: 'AG annuelle',
        body: 'Vendredi 20 à 19h.',
        audience: 'OWNERS',
        publishedByPersonId: gerant.id,
      },
    ],
  });

  // Un vote ouvert avec options + quelques bulletins (un par lot)
  const vote = await prisma.vote.create({
    data: {
      residenceId: residence.id,
      title: 'Réfection de la toiture',
      description: 'Travaux estimés à 45 000 MAD.',
      deadline: inDays(15),
      createdByPersonId: gerant.id,
    },
  });
  const optFor = await prisma.voteOption.create({
    data: { residenceId: residence.id, voteId: vote.id, label: 'Pour', sortOrder: 0 },
  });
  const optAgainst = await prisma.voteOption.create({
    data: { residenceId: residence.id, voteId: vote.id, label: 'Contre', sortOrder: 1 },
  });
  await prisma.voteOption.create({
    data: { residenceId: residence.id, voteId: vote.id, label: 'Abstention', sortOrder: 2 },
  });
  const someLots = await prisma.lot.findMany({
    where: { residenceId: residence.id },
    take: 5,
    include: { attachments: { where: { role: 'OWNER', endDate: null } } },
  });
  for (let i = 0; i < someLots.length; i++) {
    const l = someLots[i]!;
    await prisma.ballot.create({
      data: {
        residenceId: residence.id,
        voteId: vote.id,
        lotId: l.id,
        voteOptionId: i % 3 === 1 ? optAgainst.id : optFor.id,
        castByPersonId: l.attachments[0]?.personId ?? null,
        weight: l.quotePart,
      },
    });
  }

  // Un document interne, un partagé ; une invitation en attente
  const fileDoc = await prisma.fileAsset.create({
    data: {
      residenceId: residence.id,
      bucket: 'documents',
      storageKey: `documents/pv-ag-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      originalName: 'pv-ag-2025.pdf',
    },
  });
  const firstLot = someLots[0]!;
  await prisma.document.create({
    data: {
      residenceId: residence.id,
      lotId: firstLot.id,
      fileAssetId: fileDoc.id,
      name: 'PV AG 2025',
      scope: 'PARTAGE',
      origin: 'GERANT',
    },
  });
  const firstOwner = firstLot.attachments[0]?.personId;
  if (firstOwner) {
    const { createHash, randomBytes } = await import('node:crypto');
    const plainCode = randomBytes(6).toString('base64url'); // code non devinable, jamais stocké en clair
    await prisma.invitationCode.create({
      data: {
        residenceId: residence.id,
        lotId: firstLot.id,
        personId: firstOwner,
        role: 'OWNER',
        codeHash: createHash('sha256').update(plainCode).digest('hex'),
        status: 'PENDING',
        expiresAt: inDays(30),
        createdByPersonId: gerant.id,
      },
    });
  }

  // Une conversation persistée
  const conv = await prisma.conversation.create({
    data: { residenceId: residence.id, lotId: lotB2?.id ?? null },
  });
  await prisma.message.createMany({
    data: [
      {
        residenceId: residence.id,
        conversationId: conv.id,
        senderSide: 'RESIDENT',
        body: 'Quand l’ascenseur sera-t-il réparé ?',
      },
      {
        residenceId: residence.id,
        conversationId: conv.id,
        senderSide: 'GERANT',
        senderPersonId: gerant.id,
        body: 'Intervention prévue demain matin.',
      },
    ],
  });

  // Journal d'audit (exemple)
  await prisma.auditLog.create({
    data: {
      residenceId: residence.id,
      actorPersonId: gerant.id,
      action: 'seed.run',
      entityType: 'Residence',
      entityId: residence.id,
      after: { name: residence.name },
    },
  });

  // Compte de DÉMONSTRATION (déploiement) — créé UNIQUEMENT si un mot de passe est
  // fourni par l'environnement. Le mot de passe (long, aléatoire) vient de Vercel :
  // il n'est JAMAIS écrit dans le code ni journalisé. En local, cette variable est
  // absente, donc aucun compte de démo n'est créé (le dev utilise `npm run dev:account`).
  const demoPassword = process.env.DEMO_SYNDIC_PASSWORD;
  if (demoPassword && demoPassword.length >= 12) {
    const demoEmail = process.env.DEMO_SYNDIC_EMAIL ?? 'demo@syndici.ma';
    const demoPerson = await prisma.person.create({
      data: { firstName: 'Démo', lastName: 'Syndic', email: demoEmail, preferredLocale: 'fr' },
    });
    await prisma.membership.create({
      data: {
        organizationId: org.id,
        personId: demoPerson.id,
        role: 'OWNER_ADMIN',
        status: 'ACTIVE',
      },
    });
    // upsert : le seed ne purge pas la table User ; un réimport doit relier le compte
    // existant à la nouvelle Person (et réinitialiser le mot de passe), sans violer
    // l'unicité de l'e-mail.
    const demoUser = await prisma.user.upsert({
      where: { email: demoEmail },
      update: { passwordHash: await hashPassword(demoPassword) },
      create: { email: demoEmail, passwordHash: await hashPassword(demoPassword) },
    });
    await prisma.person.update({
      where: { id: demoPerson.id },
      data: { authUserId: demoUser.id },
    });
    console.log(
      `✔ Compte de démonstration créé pour ${demoEmail} (mot de passe fourni par l'environnement).`,
    );
  }

  const counts = {
    residence: residence.name,
    lots: specs.length,
    foreignOwners: specs.filter((s) => s.owner?.abroad).length,
    rentedLots: specs.filter((s) => s.tenant).length,
    vacantLots: specs.filter((s) => s.occupancy === 'VACANT').length,
    profileSettled: paidCount,
    profilePartialOverdue: partialCount,
    profileUnsettled: lateCount,
    cashPayments: cashCount,
    receipts: await prisma.receipt.count(),
    expenses: await prisma.expense.count(),
    contracts: await prisma.supplierContract.count(),
  };
  console.log('✔ Seed terminé:', JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await disconnectBase();
  });
