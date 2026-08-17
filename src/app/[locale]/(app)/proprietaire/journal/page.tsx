import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Download } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getOwnerJournal, journalLabel } from '@/server/finance/owner-journal';
import { Card } from '@/components/ui/Card';
import { formatMoney } from '@/lib/money';

/**
 * Journal d'audit du propriétaire (I8) — historique chronologique des mouvements de SES lots.
 * Réservé au rôle PROPRIETAIRE (`charge.view.own`) ; `getOwnerJournal` n'expose que ses lots
 * (jamais ceux d'un voisin). Bouton d'export CSV (mêmes données, portabilité).
 */
export default async function OwnerJournalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeC = await getLocale();
  const t = await getTranslations('ownerJournal');
  const tAcc = await getTranslations('account');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'charge.view.own')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('forbidden')}</p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
  const entries = await getOwnerJournal(actx);
  const fmt = (m: number) => formatMoney(m, localeC);
  const day = (iso: string) =>
    new Intl.DateTimeFormat(localeC, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso),
    );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-eyebrow font-bold uppercase text-indigo">{t('eyebrow')}</p>
          <h1 className="text-title text-label">{t('title')}</h1>
          <p className="text-note text-label-4">{t('subtitle')}</p>
        </div>
        {entries.length > 0 && (
          <a
            href={`/${localeC}/proprietaire/journal/export`}
            className="inline-flex items-center gap-2 rounded-md border border-sep bg-card px-3 py-2 text-note font-bold text-label-2 hover:bg-bg"
          >
            <Download className="size-4" aria-hidden />
            {t('export')}
          </a>
        )}
      </header>

      {entries.length === 0 ? (
        <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">{t('empty')}</p>
      ) : (
        <Card data-shot="journal" className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sep text-note uppercase text-label-4">
                <th className="px-4 py-2.5 text-start font-bold">{t('col.date')}</th>
                <th className="px-4 py-2.5 text-start font-bold">{t('col.lot')}</th>
                <th className="px-4 py-2.5 text-start font-bold">{t('col.type')}</th>
                <th className="px-4 py-2.5 text-end font-bold">{t('col.debit')}</th>
                <th className="px-4 py-2.5 text-end font-bold">{t('col.credit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sep">
              {entries.map((e, i) => (
                <tr key={`${e.lotReference}-${i}`}>
                  <td className="px-4 py-2.5 text-label-3">{day(e.date)}</td>
                  <td className="px-4 py-2.5 font-semibold text-label">{e.lotReference}</td>
                  <td className="px-4 py-2.5 text-label-2">
                    {journalLabel((k, v) => tAcc(k, v), e, localeC)}
                    {e.receiptNumber && (
                      <span className="ms-1 text-note text-label-4">
                        {e.receiptVoided ? '' : `· ${e.receiptNumber}`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-label-2">
                    {e.debitMinor > 0 ? fmt(e.debitMinor) : ''}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-green">
                    {e.creditMinor > 0 ? fmt(e.creditMinor) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
