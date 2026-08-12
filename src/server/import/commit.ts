/**
 * Écriture d'un import (A7) — UNE seule transaction pour toutes les lignes valides :
 * soit tout est écrit, soit rien (même garantie transactionnelle qu'en A6). Lots,
 * personnes et rattachements créés ensemble. Le dédoublonnage d'A5 s'applique (une
 * personne déjà connue est rattachée, pas dupliquée — cas MRE : même propriétaire,
 * deux lots dans le fichier). Réimporter le même fichier ne duplique rien : les
 * références déjà présentes sont classées « exists » en amont et ne parviennent
 * jamais ici.
 *
 * La couche s'appuie sur `TxRunner`/`SqlExecutor` (SQL brut typé, cf. conventions
 * §5 bis) : la même logique tourne en prod (Prisma) et en test (PGlite / Postgres réel).
 */
import type { SqlExecutor, TxRunner } from '@/server/db/sql';
import { createPerson, findAttachedPersonIdByEmail } from '@/server/auth/person-access';
import { distributeQuoteParts } from '@/server/lots/quote-part';
import { foldText } from './normalize';
import type { PersonDraft, PlannedRow } from './plan';

export interface ImportReport {
  lotsCreated: number;
  personsCreated: number;
  personsAttached: number; // rattachements créés (propriétaires + locataires)
  ignored: number; // lignes non écrites (déjà existantes + rejetées)
}

function personKey(d: PersonDraft): string {
  if (d.email) return `e:${d.email.toLowerCase()}`;
  return `n:${foldText(`${d.firstName} ${d.lastName}`)}|${(d.phone ?? '').replace(/\D/g, '')}`;
}

const INSERT_LOT = `
  INSERT INTO "Lot"
    (id,"residenceId",reference,type,"occupancyMode",floor,"surfaceM2","quotePart","monthlyChargeMinor","updatedAt")
  VALUES (gen_random_uuid(),$1,$2,$3::"LotType",$4::"OccupancyMode",$5,$6,$7,$8,now())
  RETURNING id`;

const INSERT_ATTACHMENT = `
  INSERT INTO "LotAttachment"
    (id,"residenceId","lotId","personId",role,"isChargePayer","startDate")
  VALUES (gen_random_uuid(),$1,$2,$3,$4::"AttachmentRole",$5,$6::date)`;

/**
 * Écrit les lignes « create » d'un plan. `ignored` est fourni par l'appelant (compte
 * des lignes exists+reject). Toute erreur annule l'intégralité de l'import.
 */
export async function commitImport(
  runner: TxRunner,
  ctx: { residenceId: string; role: 'SYNDIC' | 'GESTIONNAIRE' },
  createRows: PlannedRow[],
  hasQuotePartColumn: boolean,
  ignored: number,
  now: Date = new Date(),
): Promise<ImportReport> {
  const report: ImportReport = { lotsCreated: 0, personsCreated: 0, personsAttached: 0, ignored };
  if (createRows.length === 0) return report;

  // Répartition des quotes-parts sur 1000 quand la colonne est absente (comme en A3).
  const shares = hasQuotePartColumn ? [] : distributeQuoteParts(createRows.length);
  const startDate = now.toISOString().slice(0, 10);

  await runner.transaction(async (tx: SqlExecutor) => {
    const staffCtx = { personId: 'import', residenceId: ctx.residenceId, role: ctx.role } as const;
    const cache = new Map<string, string>();

    const getOrCreatePerson = async (d: PersonDraft): Promise<string> => {
      const key = personKey(d);
      const cached = cache.get(key);
      if (cached) return cached;

      // Dédoublonnage contre une personne DÉJÀ rattachée à cette résidence (par e-mail),
      // via la couche d'accès aux personnes (seule autorisée à lire le modèle Person).
      if (d.email) {
        const existing = await findAttachedPersonIdByEmail(tx, staffCtx, d.email);
        if (existing) {
          cache.set(key, existing);
          return existing;
        }
      }

      const id = await createPerson(tx, staffCtx, {
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
        nationality: d.nationality,
        preferredLocale: d.locale,
      });
      report.personsCreated++;
      cache.set(key, id);
      return id;
    };

    for (let i = 0; i < createRows.length; i++) {
      const row = createRows[i]!;
      const lot = row.lot!;
      const quotePart = hasQuotePartColumn ? (lot.quotePart ?? 1) : shares[i]!;

      const created = await tx.query<{ id: string }>(INSERT_LOT, [
        ctx.residenceId,
        lot.reference,
        lot.type,
        lot.occupancy,
        lot.floor,
        lot.surfaceM2,
        quotePart,
        lot.monthlyChargeMinor,
      ]);
      const lotId = created[0]!.id;
      report.lotsCreated++;

      // Le redevable : le propriétaire par défaut ; le locataire si les charges lui
      // sont déléguées (unicité « un seul redevable actif » respectée par lot neuf).
      if (row.owner) {
        const personId = await getOrCreatePerson(row.owner);
        await tx.query(INSERT_ATTACHMENT, [
          ctx.residenceId,
          lotId,
          personId,
          'OWNER',
          !row.delegated,
          startDate,
        ]);
        report.personsAttached++;
      }
      if (row.tenant) {
        const personId = await getOrCreatePerson(row.tenant);
        await tx.query(INSERT_ATTACHMENT, [
          ctx.residenceId,
          lotId,
          personId,
          'TENANT',
          Boolean(row.delegated),
          startDate,
        ]);
        report.personsAttached++;
      }
    }
  });

  return report;
}
