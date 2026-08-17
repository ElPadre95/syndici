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
import { getBudgetVsActual } from '@/server/finance/budget';
import { getWorksFund } from '@/server/finance/works-fund';
import { listOwnerWorksProjects } from '@/server/works/data';

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
  const tBudget = await getTranslations('budget');
  const tFund = await getTranslations('worksFund');
  const tWorks = await getTranslations('travaux');

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

  const currentYear = new Date().getUTCFullYear();
  const [treasury, expenses, contracts, budget, fund] = await Promise.all([
    getTreasury(actx),
    listExpenses(actx, { includeInternal: false }), // VISIBLE uniquement (jamais l'interne)
    listContracts(actx),
    getBudgetVsActual(actx, currentYear, t('uncategorized'), false), // réel VISIBLE seulement
    getWorksFund(actx, false), // dépenses du fonds VISIBLES seulement
  ]);
  const works = await listOwnerWorksProjects(actx); // chantiers PARTAGE seulement
  const hasFund = fund.contributedMinor !== 0 || fund.spentMinor !== 0;

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

      {/* Budget prévisionnel contre réalisé — transparence de l'exercice */}
      {budget.lines.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-section font-bold text-label">
            {tBudget('vsActualTitle')} · {budget.exercice}
          </h2>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sep text-note uppercase text-label-4">
                  <th className="px-4 py-2.5 text-start font-bold">{tBudget('category')}</th>
                  <th className="px-4 py-2.5 text-end font-bold">{tBudget('budgeted')}</th>
                  <th className="px-4 py-2.5 text-end font-bold">{tBudget('realized')}</th>
                  <th className="px-4 py-2.5 text-end font-bold">{tBudget('ecart')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sep">
                {budget.lines.map((l) => (
                  <tr key={l.categoryId ?? 'none'}>
                    <td className="px-4 py-2.5 text-label">{l.label}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-label-2">
                      {fmt(l.budgetedMinor)}
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-label-2">
                      {fmt(l.realizedMinor)}
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums">
                      <span className={l.ecartMinor < 0 ? 'font-bold text-orange' : 'text-green'}>
                        {fmt(l.ecartMinor)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-sep font-bold text-label">
                  <td className="px-4 py-2.5">{tBudget('total')}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">
                    {fmt(budget.totalBudgetedMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums">
                    {fmt(budget.totalRealizedMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums">
                    <span className={budget.totalEcartMinor < 0 ? 'text-orange' : 'text-green'}>
                      {fmt(budget.totalEcartMinor)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </section>
      )}

      {/* Fonds de provisions travaux — solde distinct de la trésorerie courante */}
      {hasFund && (
        <section className="flex flex-col gap-3">
          <h2 className="text-section font-bold text-label">{tFund('title')}</h2>
          <Card className="flex flex-wrap items-center justify-between gap-4 bg-green p-6 text-white">
            <div>
              <p className="text-eyebrow font-bold uppercase text-white/70">{tFund('balance')}</p>
              <p className="mt-1 text-stat font-extrabold tabular-nums">{fmt(fund.balanceMinor)}</p>
            </div>
            <div className="flex gap-6 text-body">
              <div>
                <p className="text-eyebrow font-semibold uppercase text-white/60">
                  {tFund('contributed')}
                </p>
                <p className="font-bold tabular-nums">{fmt(fund.contributedMinor)}</p>
              </div>
              <div>
                <p className="text-eyebrow font-semibold uppercase text-white/60">
                  {tFund('spent')}
                </p>
                <p className="font-bold tabular-nums">−{fmt(fund.spentMinor)}</p>
              </div>
            </div>
          </Card>
          {fund.expenses.length > 0 && (
            <ul className="flex flex-col gap-2">
              {fund.expenses.map((e) => (
                <li key={e.id}>
                  <Card className="flex flex-wrap items-center gap-3 p-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-soft text-indigo">
                      <Receipt className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-label">{e.description}</p>
                      <p className="text-note text-label-4">
                        {day(e.spentOn)}
                        {e.categoryLabel ? ` · ${e.categoryLabel}` : ''}
                      </p>
                    </div>
                    <span className="font-bold tabular-nums text-label-2">{fmt(e.amountMinor)}</span>
                    {e.justificatifHref && (
                      <a
                        href={e.justificatifHref}
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
      )}

      {/* Travaux — devis comparatifs mis en concurrence + photos avant/après (chantiers PARTAGE) */}
      {works.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-section font-bold text-label">{tWorks('title')}</h2>
          <ul className="flex flex-col gap-3">
            {works.map((w) => (
              <li key={w.id}>
                <Card className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-label">{w.title}</span>
                    <Badge tone={w.status === 'TERMINE' ? 'success' : w.status === 'EN_COURS' ? 'warning' : 'neutral'}>
                      {tWorks(`status.${w.status}`)}
                    </Badge>
                  </div>
                  {w.description && <p className="text-note text-label-3">{w.description}</p>}

                  {w.quotes.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-eyebrow font-bold uppercase text-label-4">
                        {tWorks('quotesTitle')}
                      </p>
                      {w.quotes.map((q) => (
                        <div
                          key={q.id}
                          className="flex flex-wrap items-center gap-2 border-b border-sep py-1.5 last:border-0"
                        >
                          <span className="font-semibold text-label">{q.supplierName}</span>
                          {q.cheapest && <Badge tone="success">{tWorks('cheapest')}</Badge>}
                          {q.selected && <Badge tone="info">{tWorks('selected')}</Badge>}
                          <span className="ms-auto font-bold tabular-nums text-label-2">
                            {fmt(q.amountMinor)}
                          </span>
                          {q.fileHref && (
                            <a
                              href={q.fileHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-soft px-2 py-1 text-note font-bold text-indigo hover:bg-indigo-mid"
                            >
                              <Paperclip className="size-3.5" aria-hidden />
                              {tWorks('viewDevis')}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {(w.photosBefore.length > 0 || w.photosAfter.length > 0) && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(['photosBefore', 'photosAfter'] as const).map((k) => {
                        const photos = w[k];
                        const label = k === 'photosBefore' ? tWorks('phaseLabel.AVANT') : tWorks('phaseLabel.APRES');
                        return (
                          <div key={k} className="flex flex-col gap-1">
                            <p className="text-eyebrow font-bold uppercase text-label-4">{label}</p>
                            {photos.length === 0 ? (
                              <p className="text-note text-label-4">—</p>
                            ) : (
                              <div className="grid grid-cols-3 gap-1.5">
                                {photos.map((ph) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={ph.id}
                                    src={ph.href}
                                    alt={ph.caption ?? ''}
                                    className="aspect-square w-full rounded-md border border-sep object-cover"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
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
