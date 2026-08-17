/**
 * Export CSV du journal du propriétaire (I8). Réservé au rôle PROPRIETAIRE : `getOwnerJournal`
 * n'expose que SES lots (le contrôle de détention est dans la couche owner). Renvoie un
 * téléchargement CSV (BOM UTF-8) — portabilité des données du propriétaire.
 */
import { getTranslations } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { getOwnerJournal, journalLabel } from '@/server/finance/owner-journal';
import { toCsv } from '@/server/export/csv';

const dh = (minor: number) => (minor / 100).toFixed(2);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale } = await params;
  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'charge.view.own')) {
    return new Response('Accès refusé.', { status: 403 });
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };

  const t = await getTranslations({ locale, namespace: 'ownerJournal' });
  const tAcc = await getTranslations({ locale, namespace: 'account' });
  const entries = await getOwnerJournal(actx);

  const headers = [
    t('col.date'),
    t('col.lot'),
    t('col.type'),
    t('col.debit'),
    t('col.credit'),
  ];
  const rows = entries.map((e) => [
    e.date.slice(0, 10),
    e.lotReference,
    journalLabel((k, v) => tAcc(k, v), e, locale),
    e.debitMinor > 0 ? dh(e.debitMinor) : '',
    e.creditMinor > 0 ? dh(e.creditMinor) : '',
  ]);

  const csv = toCsv(headers, rows);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="journal-syndici.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
