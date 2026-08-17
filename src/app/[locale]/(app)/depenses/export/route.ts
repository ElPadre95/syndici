/**
 * Export CSV des dépenses de la résidence (I8) — staff. Gardé par `charge.view.all` ; scope
 * strict à la résidence active (via `listExpenses` + `forResidence`). Période bornée par les
 * paramètres `from`/`to` (repris de l'écran Dépenses). Renvoie un téléchargement CSV.
 */
import { getTranslations } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listExpenses } from '@/server/finance/expenses';
import { toCsv } from '@/server/export/csv';

const dh = (minor: number) => (minor / 100).toFixed(2);

function parseDate(v: string | null, fallback: Date): Date {
  if (!v) return fallback;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale } = await params;
  const ctx = await getSessionContext();
  if (!ctx?.activeId || !ctx.role || !can(ctx.role, 'charge.view.all')) {
    return new Response('Accès refusé.', { status: 403 });
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };

  const url = new URL(req.url);
  const year = new Date().getUTCFullYear();
  const from = parseDate(url.searchParams.get('from'), new Date(Date.UTC(year, 0, 1)));
  const to = parseDate(url.searchParams.get('to'), new Date(Date.UTC(year, 11, 31, 23, 59, 59)));

  const t = await getTranslations({ locale, namespace: 'expenses' });
  const { rows } = await listExpenses(actx, { includeInternal: true, from, to });

  const headers = [
    t('form.date'),
    t('form.category'),
    t('form.supplier'),
    t('form.description'),
    t('form.amount'),
    t('form.visibility'),
  ];
  const body = rows.map((r) => [
    r.spentOn.slice(0, 10),
    r.categoryLabel ?? '',
    r.supplierName ?? '',
    r.description,
    dh(r.amountMinor),
    t(`visibility.${r.visibility}`),
  ]);

  const csv = toCsv(headers, body);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="depenses-syndici.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
