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
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createReceipt } from '../src/server/finance/numbering';
import { writeExpense } from '../src/server/finance/expenses';
import { defaultExpenseCategories, type ResidenceKind } from '../src/server/finance/categories';
import { storeFile } from '../src/server/storage/files';
import { prismaTxRunner } from '../src/server/db/sql';
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

/**
 * Génère un PDF minimal (justificatif de démo) portant quelques lignes de texte. Sert à
 * rendre les justificatifs RÉELLEMENT consultables via le stockage (pas une simple
 * référence morte). Texte réduit à l'ASCII (latin-1) pour des offsets xref corrects.
 */
function makeInvoicePdf(lines: string[]): Buffer {
  const ascii = (s: string) => s.normalize('NFKD').replace(/[^\x20-\x7e]/g, '');
  const body =
    'BT /F1 15 Tf 40 250 Td ' +
    lines.map((l, i) => `${i === 0 ? '' : '0 -24 Td '}(${ascii(l)}) Tj`).join(' ') +
    ' ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

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
            // Résidents marocains : préfèrent l'arabe (le message de relance WhatsApp part
            // alors en arabe). Les MRE à l'étranger restent en français/néerlandais.
            locale: 'ar' as const,
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
      // Paiement en ligne SIMULÉ activé pour la seule résidence de démo (désactivé par
      // défaut ailleurs). La plateforme ne détient jamais de fonds (cf. src/server/payments).
      onlinePaymentEnabled: true,
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
  const reminderRule = await prisma.reminderRule.create({
    data: { residenceId: residence.id, version: 1 },
  });

  // Catégories de dépenses par défaut selon le type de résidence (SPEC §7.3).
  const categories = defaultExpenseCategories(residence.type as ResidenceKind);
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
  const overdueForDunning: Array<{ lotId: string; payerPersonId: string }> = [];
  // Cas MRE : un propriétaire à l'étranger qui détient DEUX lots (une résidence
  // secondaire vide en plus de son bien principal). L'annuaire (F2) doit le montrer
  // une seule fois, avec ses deux lots — jamais en doublon.
  // Id STABLE du propriétaire MRE de démo (comme le syndic de démo) : sa Person garde le
  // MÊME id à chaque reseed, donc le jeton de session d'un propriétaire connecté survit au
  // rechargement des données (voir DECISIONS.md D33).
  const MRE_OWNER_ID = '5eed0000-0000-4000-8000-000000000003';
  let mreOwnerId: string | null = null;
  let mreOwnerLotId: string | null = null; // 1er lot du MRE → fil OWNER de démo
  let delegatedLotId: string | null = null; // lot dont les charges sont déléguées au locataire
  let delegatedTenantId: string | null = null; // son locataire → fil TENANT de démo
  let vacantLotId: string | null = null;

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
    if (!spec.owner) {
      vacantLotId = lot.id; // réservé au 2e lot du MRE (voir après la boucle).
      continue;
    }

    // Le premier propriétaire à l'étranger sera le MRE multi-lots de démo → id STABLE
    // (les autres reçoivent un uuid explicite, équivalent au défaut Prisma).
    const isMreOwner: boolean = spec.owner.abroad && mreOwnerId === null;
    const ownerId: string = isMreOwner ? MRE_OWNER_ID : randomUUID();
    const owner = await prisma.person.create({
      data: {
        id: ownerId,
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
    // Premier propriétaire à l'étranger rencontré : ce sera notre MRE multi-lots.
    if (isMreOwner) {
      mreOwnerId = owner.id;
      mreOwnerLotId = lot.id;
    }

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
      if (spec.tenantPaysCharges) {
        payerPersonId = tenant.id;
        delegatedLotId = lot.id;
        delegatedTenantId = tenant.id;
      }
    }

    if (spec.profile === 'PARTIAL_OVERDUE' || spec.profile === 'UNSETTLED_OVERDUE') {
      overdueForDunning.push({ lotId: lot.id, payerPersonId });
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

  // Le MRE prend possession du lot vacant en dur comme seconde propriété : il détient
  // désormais deux lots et doit apparaître UNE seule fois dans l'annuaire (F2).
  if (mreOwnerId && vacantLotId) {
    await prisma.lotAttachment.create({
      data: {
        residenceId: residence.id,
        lotId: vacantLotId,
        personId: mreOwnerId,
        role: 'OWNER',
        isChargePayer: true,
        startDate: monthStart(-12),
      },
    });
  }

  // Historique de relances (E1) pour la démo : certains impayés déjà relancés une ou deux
  // fois, d'autres jamais, et UN cas relancé AUJOURD'HUI que l'anti-harcèlement doit
  // EXCLURE de la liste — pour prouver que le moteur protège. Canal WhatsApp (E2).
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000);
  const mkReminder = (lotId: string, personId: string, sentAt: Date) =>
    prisma.reminder.create({
      data: {
        residenceId: residence.id,
        lotId,
        recipientPersonId: personId,
        reminderRuleId: reminderRule.id,
        channel: 'WHATSAPP',
        sentAt,
        sentByPersonId: gerant.id,
      },
    });
  let remindersSeeded = 0;
  const [t0, t1, t2] = overdueForDunning;
  if (t0) {
    await mkReminder(t0.lotId, t0.payerPersonId, daysAgo(14)); // relancé 2 fois,
    await mkReminder(t0.lotId, t0.payerPersonId, daysAgo(10)); // dernière il y a 10 j → éligible
    remindersSeeded += 2;
  }
  if (t1) {
    await mkReminder(t1.lotId, t1.payerPersonId, daysAgo(15)); // relancé 1 fois → éligible
    remindersSeeded += 1;
  }
  if (t2) {
    await mkReminder(t2.lotId, t2.payerPersonId, now); // relancé AUJOURD'HUI → exclu (< 4 j)
    remindersSeeded += 1;
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
    // Le reçu de l'encaissement annulé est voidé (B3) — son numéro reste consommé.
    await prisma.receipt.updateMany({
      where: { paymentId: toCancel.id, voidedAt: null },
      data: { voidedAt: new Date() },
    });
  }

  // Dépenses avec justificatif RÉELLEMENT stocké (C0/C1), fournisseurs marocains, et
  // quelques dépenses INTERNE (non visibles des copropriétaires) pour piloter la transparence.
  const expenseData: Array<{
    cat: string;
    desc: string;
    supplier: string | null;
    amount: number;
    offset: number;
    visibility: 'PARTAGE' | 'INTERNE';
  }> = [
    {
      cat: 'Nettoyage',
      desc: 'Nettoyage mensuel des parties communes',
      supplier: 'NetPro Services',
      amount: dh(3200),
      offset: -1,
      visibility: 'PARTAGE',
    },
    {
      cat: 'Électricité',
      desc: 'Facture électricité — communs',
      supplier: 'RADEEMA',
      amount: dh(1840),
      offset: -1,
      visibility: 'PARTAGE',
    },
    {
      cat: 'Eau commune',
      desc: 'Facture eau — arrosage & communs',
      supplier: 'RADEEC',
      amount: dh(920),
      offset: -1,
      visibility: 'PARTAGE',
    },
    {
      cat: 'Piscine commune',
      desc: "Traitement de l'eau de la piscine",
      supplier: 'AquaPro',
      amount: dh(2400),
      offset: 0,
      visibility: 'PARTAGE',
    },
    {
      cat: 'Jardins / espaces verts',
      desc: 'Taille des haies et entretien',
      supplier: 'GreenCare',
      amount: dh(1800),
      offset: 0,
      visibility: 'PARTAGE',
    },
    {
      cat: 'Assurance',
      desc: 'Assurance multirisque (acompte annuel)',
      supplier: 'Wafa Assurance',
      amount: dh(1000),
      offset: -2,
      visibility: 'PARTAGE',
    },
    {
      cat: 'Autre',
      desc: 'Honoraires de gestion du syndic',
      supplier: 'Cabinet Al Amane',
      amount: dh(2500),
      offset: -1,
      visibility: 'INTERNE',
    },
    {
      cat: 'Gardiennage',
      desc: 'Prime exceptionnelle gardien',
      supplier: null,
      amount: dh(600),
      offset: 0,
      visibility: 'INTERNE',
    },
  ];
  for (const e of expenseData) {
    const pdf = makeInvoicePdf([
      'Justificatif de depense',
      `Fournisseur : ${e.supplier ?? '-'}`,
      `Montant : ${(e.amount / 100).toFixed(2)} MAD`,
      `Objet : ${e.desc}`,
    ]);
    const stored = await storeFile(
      { residenceId: residence.id },
      {
        bucket: 'justificatifs',
        body: pdf,
        mimeType: 'application/pdf',
        originalName: `facture-${(e.supplier ?? e.cat).replace(/[^a-zA-Z0-9]/g, '')}.pdf`,
        uploadedByPersonId: gerant.id,
      },
    );
    await writeExpense(prismaTxRunner(), {
      residenceId: residence.id,
      categoryId: catByLabel.get(e.cat) ?? null,
      description: e.desc,
      amountMinor: e.amount,
      spentOn: monthStart(e.offset),
      supplierName: e.supplier,
      visibility: e.visibility,
      justificatifId: stored.ok ? stored.id : null,
      actorPersonId: gerant.id,
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

  // Actualités typées, audiences variées (dont une réservée aux locataires) pour montrer
  // le filtrage : un propriétaire ne voit pas l'actu « locataires », et inversement.
  await prisma.announcement.createMany({
    data: [
      {
        residenceId: residence.id,
        type: 'URGENT',
        title: 'Panne ascenseur',
        body: "Ascenseur du bloc B à l'arrêt. Technicien prévu demain matin. Merci de votre patience.",
        audience: 'ALL',
        publishedByPersonId: gerant.id,
      },
      {
        residenceId: residence.id,
        type: 'TRAVAUX',
        title: 'Nettoyage de la façade',
        body: 'Travaux de nettoyage de la façade la semaine prochaine, du lundi au mercredi.',
        audience: 'ALL',
        publishedByPersonId: gerant.id,
      },
      {
        residenceId: residence.id,
        type: 'REUNION',
        title: 'Assemblée générale annuelle',
        body: "L'AG se tiendra le vendredi 20 à 19h en salle commune. Ordre du jour à venir.",
        audience: 'OWNERS',
        publishedByPersonId: gerant.id,
      },
      {
        residenceId: residence.id,
        type: 'INFORMATION',
        title: 'Rappel — dépôt des ordures',
        body: 'Merci de sortir les poubelles après 20h uniquement, et de respecter le tri.',
        audience: 'TENANTS',
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

  // Documents (F3) : les TROIS portées représentées, fichiers réellement stockés via la
  // couche C0 (en local sur disque, en prod dans le Blob privé) — plus de `FileAsset`
  // fantôme sans octets. Règlement + PV = toute la résidence ; assurance = partagée avec
  // le syndic ; attestation = privée à un résident.
  const firstLot = someLots[0]!;
  const firstOwner = firstLot.attachments[0]?.personId ?? null;
  const tinyPdf = (title: string) =>
    Buffer.from(`%PDF-1.4\n% ${title} — document de démonstration Syndici\n%%EOF\n`, 'utf8');
  const seedDoc = async (opts: {
    name: string;
    type: 'REGLEMENT' | 'PV_AG' | 'ASSURANCE' | 'ATTESTATION' | 'AUTRE';
    scope: 'PRIVE' | 'PARTAGE' | 'RESIDENCE';
    uploadedByPersonId: string | null;
    origin?: 'GERANT' | 'RESIDENT';
    personId?: string | null;
  }) => {
    const stored = await storeFile(
      { residenceId: residence.id },
      {
        bucket: 'documents',
        body: tinyPdf(opts.name),
        mimeType: 'application/pdf',
        originalName: `${opts.name}.pdf`,
        uploadedByPersonId: opts.uploadedByPersonId,
      },
    );
    if (!stored.ok) throw new Error(`seed document échoué (${opts.name}) : ${stored.error}`);
    await prisma.document.create({
      data: {
        residenceId: residence.id,
        fileAssetId: stored.id,
        name: opts.name,
        type: opts.type,
        scope: opts.scope,
        origin: opts.origin ?? 'GERANT',
        personId: opts.personId ?? null,
      },
    });
  };
  await seedDoc({
    name: 'Règlement de copropriété',
    type: 'REGLEMENT',
    scope: 'RESIDENCE',
    uploadedByPersonId: gerant.id,
  });
  await seedDoc({
    name: 'PV AG 2025',
    type: 'PV_AG',
    scope: 'RESIDENCE',
    uploadedByPersonId: gerant.id,
  });
  await seedDoc({
    name: 'Contrat d’assurance',
    type: 'ASSURANCE',
    scope: 'PARTAGE',
    uploadedByPersonId: gerant.id,
  });
  if (firstOwner)
    await seedDoc({
      name: 'Attestation fiscale',
      type: 'ATTESTATION',
      scope: 'PRIVE',
      uploadedByPersonId: firstOwner,
      origin: 'RESIDENT',
      personId: firstOwner,
    });

  // Une invitation en attente
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

  // Messagerie (G4) — LE MUR en action : un fil PROPRIÉTAIRE (sur le 1er lot du MRE) et un
  // fil LOCATAIRE (sur le lot dont les charges sont déléguées) sont DISTINCTS. Le
  // propriétaire n'atteint jamais le second, le locataire jamais le premier ; le syndic voit
  // les deux. Chaque fil a des messages des DEUX côtés ; le fil propriétaire porte une pièce
  // jointe RÉELLEMENT stockée (consultable via la route signée, re-gardée au niveau du fil).
  if (mreOwnerLotId && mreOwnerId) {
    const ownerConv = await prisma.conversation.create({
      data: { residenceId: residence.id, lotId: mreOwnerLotId, counterpartyRole: 'OWNER' },
    });
    const relevePdf = makeInvoicePdf([
      'Relevé de charges — appartement A1',
      'Exercice en cours — copropriété Al Firdaous',
      'Document de démonstration transmis via la messagerie.',
    ]);
    const storedReleve = await storeFile(
      { residenceId: residence.id },
      {
        bucket: 'messages',
        body: relevePdf,
        mimeType: 'application/pdf',
        originalName: 'releve-charges-A1.pdf',
        uploadedByPersonId: gerant.id,
      },
    );
    await prisma.message.create({
      data: {
        residenceId: residence.id,
        conversationId: ownerConv.id,
        senderSide: 'RESIDENT',
        senderPersonId: mreOwnerId,
        body: 'Bonjour, pouvez-vous me transmettre le relevé de mes charges ?',
      },
    });
    await prisma.message.create({
      data: {
        residenceId: residence.id,
        conversationId: ownerConv.id,
        senderSide: 'GERANT',
        senderPersonId: gerant.id,
        body: 'Bonjour, bien sûr — vous le trouverez ci-joint.',
        fileAssetId: storedReleve.ok ? storedReleve.id : null,
      },
    });
  }

  if (delegatedLotId && delegatedTenantId) {
    const tenantConv = await prisma.conversation.create({
      data: { residenceId: residence.id, lotId: delegatedLotId, counterpartyRole: 'TENANT' },
    });
    await prisma.message.createMany({
      data: [
        {
          residenceId: residence.id,
          conversationId: tenantConv.id,
          senderSide: 'RESIDENT',
          senderPersonId: delegatedTenantId,
          body: 'Quand l’ascenseur sera-t-il réparé ?',
        },
        {
          residenceId: residence.id,
          conversationId: tenantConv.id,
          senderSide: 'GERANT',
          senderPersonId: gerant.id,
          body: 'Intervention prévue demain matin.',
        },
      ],
    });
  }

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
    // Identité STABLE du compte de démo : la Person garde le MÊME id à chaque rechargement
    // des données. Sans cela, un reseed recrée la personne avec un nouvel id et périme le
    // jeton de session (personId disparu) → l'utilisateur retombait sur une coquille vide.
    // Avec un id fixe, la session survit au reseed (le rôle et la résidence sont recalculés
    // à chaque requête à partir de ce personId stable).
    const DEMO_PERSON_ID = '5eed0000-0000-4000-8000-000000000001';
    const demoPerson = await prisma.person.create({
      data: {
        id: DEMO_PERSON_ID,
        firstName: 'Démo',
        lastName: 'Syndic',
        email: demoEmail,
        preferredLocale: 'fr',
      },
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

    // Compte de démonstration PROPRIÉTAIRE (MRE, 2 lots) — même mécanisme, même mot de
    // passe. Aucune adhésion : son rôle PROPRIETAIRE dérive de ses rattachements de lot.
    // Son id est stable (MRE_OWNER_ID) → sa session survit aux reseeds.
    if (mreOwnerId) {
      const ownerEmail = process.env.DEMO_OWNER_EMAIL ?? 'proprietaire@syndici.ma';
      const ownerUser = await prisma.user.upsert({
        where: { email: ownerEmail },
        update: { passwordHash: await hashPassword(demoPassword) },
        create: { email: ownerEmail, passwordHash: await hashPassword(demoPassword) },
      });
      await prisma.person.update({ where: { id: mreOwnerId }, data: { authUserId: ownerUser.id } });
      console.log(`✔ Compte de démonstration propriétaire créé pour ${ownerEmail}.`);
    }
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
    reminders: remindersSeeded,
    announcements: await prisma.announcement.count(),
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
