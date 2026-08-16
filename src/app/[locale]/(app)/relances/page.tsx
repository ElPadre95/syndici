import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, BellRing, CheckCircle2 } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listDunning } from '@/server/finance/dunning';
import { waPhoneDigits } from '@/server/finance/reminders';
import { RemindersPanel, type ReminderRow } from '@/components/finance/RemindersPanel';
import { formatMoney } from '@/lib/money';

/**
 * Relances (E1 détection + E2 envoi). Liste du moteur §7.1 (seuils de la `ReminderRule`,
 * anti-harcèlement). Chaque relance ouvre un lien WhatsApp pré-rempli, dans la langue du
 * destinataire, éditable avant envoi ; l'intention est tracée. Staff (`reminder.manage`).
 */
export default async function RelancesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const activeLocale = await getLocale();
  const t = await getTranslations('relances');

  const ctx = await getSessionContext();
  const active = ctx?.residences.find((r) => r.id === ctx.activeId) ?? null;
  if (!ctx?.activeId || !ctx.role || !active) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
          <Building2 className="size-6" aria-hidden />
        </span>
        <p className="text-base font-bold text-label">{t('noActiveTitle')}</p>
        <p className="max-w-sm text-sm text-label-3">{t('noActiveBody')}</p>
      </div>
    );
  }
  if (!can(ctx.role, 'reminder.manage')) {
    return (
      <p className="mx-auto max-w-3xl rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
        {t('forbidden')}
      </p>
    );
  }

  const { items } = await listDunning({
    personId: ctx.personId,
    residenceId: ctx.activeId,
    role: ctx.role,
  });

  // Message de relance dans la LANGUE DU DESTINATAIRE (contenu = catalogues).
  const tFr = await getTranslations({ locale: 'fr', namespace: 'relances' });
  const tAr = await getTranslations({ locale: 'ar', namespace: 'relances' });
  const fmtDate = new Intl.DateTimeFormat(activeLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const periodsOf = (loc: string, periods: { year: number; month: number }[]) =>
    periods
      .map((p) =>
        new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(
          new Date(p.year, p.month - 1, 1),
        ),
      )
      .join(loc === 'ar' ? '، ' : ', ');

  const rows: ReminderRow[] = items.map((it) => {
    const tt = it.recipientLocale === 'ar' ? tAr : tFr;
    return {
      lotId: it.lotId,
      lotReference: it.lotReference,
      recipientName: it.recipientName,
      phoneDigits: waPhoneDigits(it.recipientPhone),
      amountLabel: formatMoney(it.amountDueMinor, activeLocale),
      retardDays: it.retardDays,
      stage: it.stage,
      remindersSent: it.remindersSent,
      lastSentLabel: it.lastReminderAt ? fmtDate.format(new Date(it.lastReminderAt)) : null,
      defaultMessage: tt('message.whatsapp', {
        name: it.recipientName ?? '',
        lot: it.lotReference,
        residence: active.name,
        periods: periodsOf(it.recipientLocale, it.periods),
        amount: formatMoney(it.amountDueMinor, it.recipientLocale),
        days: it.retardDays,
      }),
    };
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-green-soft text-green">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <p className="text-base font-bold text-label">{t('emptyTitle')}</p>
          <p className="max-w-sm text-sm text-label-3">{t('emptyBody')}</p>
        </div>
      ) : (
        <>
          <div className="border-orange/30 flex items-center gap-3 rounded-lg border bg-orange-soft px-4 py-3">
            <BellRing className="size-5 shrink-0 text-orange" aria-hidden />
            <p className="text-sm font-bold text-orange">
              {t('banner', { count: rows.length })}
              <span className="text-orange/80 ms-2 font-semibold">{t('autoDetected')}</span>
            </p>
          </div>
          <RemindersPanel items={rows} />
        </>
      )}
    </div>
  );
}
