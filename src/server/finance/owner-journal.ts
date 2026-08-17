/**
 * Journal d'audit du propriétaire (I8) — historique chronologique des mouvements de SES lots :
 * appels de charges, règlements, annulations, frais de retard, régularisations. Réutilise
 * `getOwnerLotAccount` (contrôle de détention intégré) : le propriétaire ne voit JAMAIS le
 * lot d'un voisin. Le tri (plus récent d'abord) est PUR et testable.
 */
import { listOwnerLots, getOwnerLotAccount } from './owner';
import type { LedgerEntry } from './account';
import type { ActiveContext } from '@/server/auth/context';

export interface JournalEntry extends LedgerEntry {
  lotReference: string;
}

/**
 * Fusionne les grands livres de plusieurs lots en un journal unique, trié du plus récent au
 * plus ancien (à date égale : débit avant crédit, comme le grand livre). Fonction PURE.
 */
export function mergeJournalEntries(
  perLot: readonly { lotReference: string; entries: readonly LedgerEntry[] }[],
): JournalEntry[] {
  const all: JournalEntry[] = [];
  for (const lot of perLot) {
    for (const e of lot.entries) all.push({ ...e, lotReference: lot.lotReference });
  }
  const debitFirst = (k: LedgerEntry['kind']) =>
    k === 'charge' || k === 'latefee' || k === 'regularisation' ? 0 : 1;
  return all.sort(
    (a, b) => b.date.localeCompare(a.date) || debitFirst(a.kind) - debitFirst(b.kind),
  );
}

/**
 * Libellé lisible d'une écriture, dans la langue voulue. `t` est un traducteur du namespace
 * `account` (réutilise les mêmes libellés que le relevé de compte). Fonction PURE.
 */
export function journalLabel(
  t: (key: string, values?: Record<string, string | number>) => string,
  e: JournalEntry,
  locale: string,
): string {
  switch (e.kind) {
    case 'charge':
      return t('label.charge', {
        period:
          e.periodYear && e.periodMonth
            ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
                new Date(e.periodYear, e.periodMonth - 1, 1),
              )
            : '',
      });
    case 'latefee':
      return t('label.latefee');
    case 'latefee_reversal':
      return t('label.latefeeReversal');
    case 'regularisation':
      return t('label.regularisation', { exercice: e.periodYear ?? '' });
    case 'reversal':
      return t('label.reversal', { method: t(`method.${e.method}`) });
    default:
      return t('label.payment', { method: t(`method.${e.method}`) });
  }
}

/** Journal d'audit du propriétaire connecté (tous ses lots), le plus récent d'abord. */
export async function getOwnerJournal(ctx: ActiveContext): Promise<JournalEntry[]> {
  const lots = await listOwnerLots(ctx);
  const perLot: { lotReference: string; entries: LedgerEntry[] }[] = [];
  for (const lot of lots) {
    const account = await getOwnerLotAccount(ctx, lot.lotId);
    if (account) perLot.push({ lotReference: account.lotReference, entries: account.entries });
  }
  return mergeJournalEntries(perLot);
}
