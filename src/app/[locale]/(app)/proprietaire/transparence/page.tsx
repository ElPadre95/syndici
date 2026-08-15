import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Receipt, FileSignature, Paperclip, TrendingUp, TrendingDown } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { formatMoney } from '@/lib/money';
import { signedFilePath } from '@/server/storage/sign';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getTreasury } from '@/server/finance/treasury';
import { listExpenses, aggregateByCategory } from '@/server/finance/expenses';
import { listContracts } from '@/server/finance/contracts';

/**
 * Transparence (G3) — le cœur de la promesse. Le propriétaire voit les dépenses VISIBLES de
 * sa résidence (jamais l'INTERNE), leur répartition par catégorie, et surtout les
 * justificatifs consultables via la route signée C0 ; plus le budget/trésorerie et les
 * contrats en cours. Réservé au rôle PROPRIETAIRE (`expense.view` — que le locataire N'A PAS,
 * donc il n'atteint jamais cet écran). `includeInternal: false` garantit l'invisibilité de
 * l'interne ; on ne signe QUE les justificatifs des dépenses visibles.
 */
export default async function OwnerTransparencyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeC = await getLocale();
  const t = await getTranslations('owner');
  const tContract = await getTranslations('contracts');

  const ctx = await getSessionContext();
  if (!ctx?.activeId || ctx.role !== 'PROPRIETAIRE' || !can(ctx.role, 'expense.view')) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">
          {t('forbidden')}
        </p>
      </div>
    );
  }
  const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };

  const [treasury, expenses, contracts] = await Promise.all([
    getTreasury(actx),
    listExpenses(actx, { includeInternal: false }), // VISIBLE uniquement (jamais l'interne)
    listContracts(actx),
  ]);

  const fmt = (m: number) => formatMoney(m, localeC);
  const day = (iso: string) =>
    new Intl.DateTimeFormat(localeC, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso),
    );

  const byCategory = aggregateByCategory(
    expenses.rows.filter((e) => !e.isReversal && !e.reversed),
    t('uncategorized'),
  );
  const recentExpenses = expenses.rows.filter((e) => !e.isReversal).slice(0, 8);
  const activeContracts = contracts.filter((c) => c.tier !== 'expired').slice(0, 6);
  const countdown = (c: (typeof contracts)[number]) =>
    c.tier === 'expired'
      ? tContract('countdown.expired')
      : c.daysUntil === 0
        ? tContract('countdown.today')
        : tContract('countdown.days', { days: c.daysUntil });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="text-eyebrow font-bold uppercase text-indigo">{t('myChargesEyebrow')}</p>
        <h1 className="text-title text-label">{t('transparencyTitle')}</h1>
      </header>

      {/* Budget & trésorerie — bloc dominant */}
      <section className="relative overflow-hidden rounded-lg bg-grad-indigo p-6 text-white shadow-md">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 end-[-40px] size-52 rounded-full bg-white/10"
        />
        <p className="text-eyebrow font-bold uppercase text-white/70">{t('treasuryTitle')}</p>
        <p className="relative mt-1 text-display font-extrabold tabular-nums">
          {fmt(treasury.netMinor)}
        </p>
        <div className="relative mt-5 grid grid-cols-1 gap-3 border-t border-white/15 pt-4 sm:grid-cols-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-white/70" aria-hidden />
            <span className="text-eyebrow font-semibold uppercase text-white/60">
              {t('collected')}
            </span>
            <span className="ms-auto text-body font-bold tabular-nums">
              {fmt(treasury.collectedMinor)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="size-4 text-white/70" aria-hidden />
            <span className="text-eyebrow font-semibold uppercase text-white/60">{t('spent')}</span>
            <span className="ms-auto text-body font-bold tabular-nums">
              −{fmt(treasury.spentMinor)}
            </span>
          </div>
        </div>
      </section>

      {/* Dépenses par catégorie */}
      {byCategory.rows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-section font-bold text-label">{t('byCategory')}</h2>
          <Card className="flex flex-col gap-3">
            {byCategory.rows.map((r) => {
              const pct =
                byCategory.totalMinor > 0 ? (r.totalMinor / byCategory.totalMinor) * 100 : 0;
              return (
                <div key={r.categoryId ?? 'none'} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 text-body">
                    <span className="font-semibold text-label">{r.label}</span>
                    <span className="tabular-nums text-label-2">{fmt(r.totalMinor)}</span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-indigo"
                      style={{ width: `${Math.round(pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {/* Dépenses de la résidence + justificatifs (route signée C0) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-section font-bold text-label">{t('expensesTitle')}</h2>
        {recentExpenses.length === 0 ? (
          <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">
            {t('noExpenses')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentExpenses.map((e) => (
              <li key={e.id}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-soft text-indigo">
                    <Receipt className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-label">
                      {e.supplierName ?? e.description}
                    </p>
                    <p className="text-note text-label-4">
                      {day(e.spentOn)}
                      {e.categoryLabel ? ` · ${e.categoryLabel}` : ''}
                    </p>
                  </div>
                  <span className="font-bold tabular-nums text-label-2">{fmt(e.amountMinor)}</span>
                  {e.justificatifId && (
                    <a
                      href={signedFilePath(e.justificatifId, 3600)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-soft px-2.5 py-1.5 text-note font-bold text-indigo hover:bg-indigo-mid"
                    >
                      <Paperclip className="size-3.5" aria-hidden />
                      {t('justificatif')}
                    </a>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Contrats en cours */}
      <section className="flex flex-col gap-3">
        <h2 className="text-section font-bold text-label">{t('contractsTitle')}</h2>
        {activeContracts.length === 0 ? (
          <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">
            {t('noContracts')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeContracts.map((c) => (
              <li key={c.id}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-soft text-indigo">
                    <FileSignature className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-label">{c.name}</p>
                    <p className="text-note text-label-4">
                      {c.supplierName ?? '—'} · {tContract('due', { date: day(c.endDate) })}
                    </p>
                  </div>
                  {c.amountMinor != null && (
                    <span className="font-bold tabular-nums text-label-2">
                      {fmt(c.amountMinor)}
                    </span>
                  )}
                  <Badge tone={c.tier === 'soon' ? 'warning' : 'neutral'}>{countdown(c)}</Badge>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
