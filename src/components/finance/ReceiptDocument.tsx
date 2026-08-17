import { getLocale, getTranslations } from 'next-intl/server';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import type { ReceiptView } from '@/server/finance/receipts';

/**
 * Reçu imprimable (B3). Document sobre et officiel, identique à chaque réimpression
 * (données figées en base). RTL géré par les propriétés logiques. Un reçu annulé
 * (encaissement inversé) porte un bandeau « annulé » — son numéro reste valide comme
 * référence comptable mais le document ne vaut plus quittance.
 */
export async function ReceiptDocument({ receipt }: { receipt: ReceiptView }) {
  const t = await getTranslations('receipts');
  const locale = await getLocale();
  const fmtDate = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const fmtPeriod = (p: { year: number; month: number }) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(p.year, p.month - 1, 1),
    );

  const rows: Array<[string, string]> = [
    [t('doc.payer'), receipt.payerName ?? '—'],
    [t('doc.lot'), receipt.lotReference ?? '—'],
    [t('doc.periods'), receipt.periods.length ? receipt.periods.map(fmtPeriod).join(' · ') : '—'],
    [t('doc.method'), t(`method.${receipt.method}`)],
    [t('doc.reference'), receipt.reference ?? '—'],
    [t('doc.receivedAt'), fmtDate.format(new Date(receipt.receivedAt))],
  ];

  return (
    <article
      data-print-root
      data-shot="recu"
      className={cn(
        'mx-auto flex w-full max-w-xl flex-col gap-6 rounded-lg border border-sep bg-white p-8',
        receipt.voidedAt && 'opacity-95',
      )}
    >
      {/* En-tête : cabinet / résidence */}
      <header className="flex flex-col gap-1 border-b border-sep pb-4">
        {receipt.residence.orgName && (
          <p className="text-xs font-bold uppercase tracking-wide text-label-4">
            {receipt.residence.orgName}
          </p>
        )}
        <p className="text-lg font-extrabold text-label">{receipt.residence.name}</p>
        {(receipt.residence.address || receipt.residence.city) && (
          <p className="text-xs text-label-3">
            {[receipt.residence.address, receipt.residence.city].filter(Boolean).join(', ')}
          </p>
        )}
      </header>

      {receipt.voidedAt && (
        <p className="rounded-md bg-orange-soft px-3 py-2 text-center text-sm font-extrabold uppercase tracking-wide text-orange">
          {t('doc.voided')}
        </p>
      )}

      {/* Titre + numéro */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-label">{t('doc.title')}</h1>
        <p className="font-mono text-sm font-bold text-label-3">{receipt.number}</p>
      </div>

      {/* Montant */}
      <div className="rounded-md bg-bg px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-label-4">
          {t('doc.amount')}
        </p>
        <p className="text-3xl font-extrabold tabular-nums text-label">
          {formatMoney(receipt.amountMinor, locale)}
        </p>
      </div>

      {/* Détails */}
      <dl className="flex flex-col divide-y divide-sep">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2 text-sm">
            <dt className="font-semibold text-label-4">{label}</dt>
            <dd className="text-end font-semibold text-label">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Pied : émission (mention « par … » seulement si l'émetteur est connu) */}
      <footer className="border-t border-sep pt-4 text-xs text-label-4">
        {receipt.recordedByName
          ? t('doc.issuedLine', {
              date: fmtDate.format(new Date(receipt.issuedAt)),
              by: receipt.recordedByName,
            })
          : t('doc.issuedAtOnly', { date: fmtDate.format(new Date(receipt.issuedAt)) })}
      </footer>
    </article>
  );
}
