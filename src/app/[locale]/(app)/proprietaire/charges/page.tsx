import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import {
  Home,
  FileText,
  Receipt as ReceiptIcon,
  AlertTriangle,
  ArrowRight,
  CreditCard,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import { listOwnerLots, getOwnerLotCharges, getOwnerLotPayments } from '@/server/finance/owner';
import { isOnlinePaymentEnabled } from '@/server/payments/provider';

/**
 * Mes charges (G2) — vue PROPRIÉTAIRE : l'historique des appels de son lot avec statut
 * dérivé, ses paiements (n° de reçu + réimpression), et l'accès à son relevé de compte.
 * Réservé au rôle PROPRIETAIRE ; scopé aux lots qu'il détient (le sélecteur ne propose que
 * ses lots, et les lectures re-vérifient la détention). Le lot actif passe par l'URL.
 */
export default async function OwnerChargesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ lot?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeC = await getLocale();
  const { lot: lotParam } = await searchParams;
  const t = await getTranslations('owner');
  const tPay = await getTranslations('payments');
  const tOnline = await getTranslations('pay');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'charge.view.own')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">
          {t('forbidden')}
        </p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };

  const lots = await listOwnerLots(actx);
  if (lots.length === 0) {
    return <EmptyState Icon={Home} title={t('noLots')} />;
  }
  const wanted = Array.isArray(lotParam) ? lotParam[0] : lotParam;
  const activeLot = lots.find((l) => l.lotId === wanted) ?? lots[0]!;
  const [charges, payments, onlinePay] = await Promise.all([
    getOwnerLotCharges(actx, activeLot.lotId),
    getOwnerLotPayments(actx, activeLot.lotId),
    isOnlinePaymentEnabled(ctx.activeId),
  ]);

  const fmt = (m: number) => formatMoney(m, localeC);
  const period = (y: number, mo: number) =>
    new Intl.DateTimeFormat(localeC, { month: 'long', year: 'numeric' }).format(
      new Date(y, mo - 1, 1),
    );
  const day = (iso: string) =>
    new Intl.DateTimeFormat(localeC, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso),
    );
  const tone = (s: string) =>
    s === 'SETTLED' ? 'success' : s === 'PARTIAL' ? 'warning' : 'danger';

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="text-eyebrow font-bold uppercase text-indigo">{t('myChargesEyebrow')}</p>
        <h1 className="text-title text-label">{t('myChargesTitle')}</h1>
      </header>

      {/* Sélecteur de lot (le cas MRE) */}
      {lots.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {lots.map((l) => (
            <Link
              key={l.lotId}
              href={{ pathname: '/proprietaire/charges', query: { lot: l.lotId } }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-note font-bold transition-colors',
                l.lotId === activeLot.lotId
                  ? 'bg-indigo text-white'
                  : 'border border-sep bg-card text-label-2 hover:bg-bg',
              )}
            >
              <Home className="size-3.5" aria-hidden />
              {t('lot', { ref: l.reference })}
            </Link>
          ))}
        </div>
      )}

      {/* Charges déléguées au locataire : dit clairement */}
      {!activeLot.isChargePayer && (
        <p className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-note font-semibold text-orange">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {t('delegated')}
        </p>
      )}

      {/* Relevé de compte */}
      <Link
        href={`/proprietaire/lots/${activeLot.lotId}/compte`}
        className="inline-flex items-center gap-1.5 self-start text-body font-semibold text-indigo hover:underline"
      >
        <FileText className="size-4" aria-hidden />
        {t('statementLink')}
        <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
      </Link>

      {/* Historique des appels */}
      <section className="flex flex-col gap-3">
        <h2 className="text-section font-bold text-label">{t('chargesHistory')}</h2>
        {charges.length === 0 ? (
          <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">
            {t('noCharges')}
          </p>
        ) : (
          <Table className="min-w-[560px]">
            <THead>
              <Tr>
                <Th>{t('colPeriod')}</Th>
                <Th className="text-end">{t('colAmount')}</Th>
                <Th className="text-end">{t('colRemaining')}</Th>
                <Th>{t('colStatus')}</Th>
                {onlinePay && <Th className="text-end">{tOnline('cta')}</Th>}
              </Tr>
            </THead>
            <TBody>
              {charges.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-semibold text-label">{period(c.year, c.month)}</Td>
                  <Td className="text-end tabular-nums">{fmt(c.amountMinor)}</Td>
                  <Td className="text-end font-semibold tabular-nums">
                    {c.remainingMinor > 0 ? fmt(c.remainingMinor) : '—'}
                  </Td>
                  <Td>
                    <Badge tone={tone(c.settlement)}>{tPay(`settlement.${c.settlement}`)}</Badge>
                    {c.temporal === 'OVERDUE' && c.settlement !== 'SETTLED' && (
                      <Badge tone="danger" className="ms-1">
                        {tPay('late', { days: c.daysLate })}
                      </Badge>
                    )}
                  </Td>
                  {onlinePay && (
                    <Td className="text-end">
                      {c.remainingMinor > 0 && (
                        <Link
                          href={`/proprietaire/payer/${c.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-indigo px-2.5 py-1.5 text-note font-bold text-white transition-opacity hover:opacity-90"
                        >
                          <CreditCard className="size-3.5" aria-hidden />
                          {tOnline('cta')}
                        </Link>
                      )}
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      {/* Mes paiements + réimpression de reçu */}
      <section className="flex flex-col gap-3">
        <h2 className="text-section font-bold text-label">{t('paymentsHistory')}</h2>
        {payments.length === 0 ? (
          <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">
            {t('noPayments')}
          </p>
        ) : (
          <Table className="min-w-[560px]">
            <THead>
              <Tr>
                <Th>{t('colDate')}</Th>
                <Th>{t('colMethod')}</Th>
                <Th className="text-end">{t('colAmount')}</Th>
                <Th className="text-end">{t('colReceipt')}</Th>
              </Tr>
            </THead>
            <TBody>
              {payments.map((p) => (
                <Tr key={p.id} className={cn(p.reversed && 'text-label-4 line-through')}>
                  <Td className="font-semibold text-label">{day(p.receivedAt)}</Td>
                  <Td>{tPay(`method.${p.method}`)}</Td>
                  <Td
                    className={cn(
                      'text-end font-bold tabular-nums',
                      p.isReversal ? 'text-red' : 'text-green',
                    )}
                  >
                    {p.isReversal ? '−' : ''}
                    {fmt(Math.abs(p.amountMinor))}
                  </Td>
                  <Td className="text-end">
                    {p.receiptId && !p.isReversal ? (
                      <Link
                        href={`/proprietaire/recus/${p.receiptId}`}
                        className="inline-flex items-center gap-1 text-note font-semibold text-indigo hover:underline"
                      >
                        <ReceiptIcon className="size-3.5" aria-hidden />
                        {p.receiptNumber ?? t('reprint')}
                      </Link>
                    ) : (
                      <span className="text-label-4">—</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}
