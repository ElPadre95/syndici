import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, CreditCard } from 'lucide-react';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import {
  getResidenceSettings,
  getActiveReminderRule,
  getLateFeeSettings,
  listCategoriesForSettings,
  getSubscription,
} from '@/server/settings/data';
import { LateFeeSettings } from '@/components/settings/LateFeeSettings';
import { CurrencyRatesForm } from '@/components/settings/CurrencyRatesForm';
import { listCurrencyRates } from '@/server/finance/currency';
import { prismaExecutor } from '@/server/db/sql';
import { listMembers } from '@/server/org/data';
import { isLastActiveAdmin } from '@/server/org/members';
import { ResidenceSettingsForm } from '@/components/settings/ResidenceSettingsForm';
import { ReminderRuleForm } from '@/components/settings/ReminderRuleForm';
import { CategoriesManager } from '@/components/settings/CategoriesManager';
import { MembersManager } from '@/components/settings/MembersManager';
import { Card } from '@/components/ui/Card';

/**
 * Réglages (F1). Éditer la résidence, régler les seuils de relance, gérer les catégories
 * de dépenses, voir l'abonnement. Réservé au syndic (`residence.settings`) ; toute
 * modification est tracée au journal d'audit.
 */
export default async function ReglagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

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
  if (!can(ctx.role, 'residence.settings')) {
    return (
      <p className="mx-auto max-w-3xl rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
        {t('forbidden')}
      </p>
    );
  }
  const scopedCtx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };

  const [residence, rule, lateFee, currencyRates, categories, subscription] = await Promise.all([
    getResidenceSettings(ctx.activeId),
    getActiveReminderRule(ctx.activeId),
    getLateFeeSettings(ctx.activeId),
    listCurrencyRates(scopedCtx),
    listCategoriesForSettings(scopedCtx),
    getSubscription(scopedCtx),
  ]);
  const tLate = await getTranslations('lateFees');
  const tCur = await getTranslations('currency');
  if (!residence) {
    // Résidence active introuvable (supprimée en cours de session) : message explicite,
    // jamais une page blanche silencieuse.
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

  // Membres du cabinet (F4) — réservé à l'administrateur (`member.manage` = SYNDIC).
  const canManageMembers = can(ctx.role, 'member.manage');
  const org = canManageMembers ? await listMembers(prismaExecutor(), scopedCtx) : null;
  const memberRows = org
    ? org.members.map((m) => ({
        membershipId: m.membershipId,
        fullName: `${m.firstName} ${m.lastName}`.trim(),
        email: m.email,
        role: m.role,
        status: m.status,
        hasAccount: m.hasAccount,
        endedAt: m.endedAt,
        isProtected: isLastActiveAdmin(org.members, m.membershipId),
        isSelf: m.personId === ctx.personId,
      }))
    : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
        <p className="mt-1 text-sm text-label-3">{t('subtitle', { residence: active.name })}</p>
      </div>

      <ResidenceSettingsForm current={residence} />

      {rule && <ReminderRuleForm current={rule} />}

      {lateFee && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-label">{tLate('title')}</h2>
          <LateFeeSettings settings={lateFee} />
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-label">{tCur('title')}</h2>
        <CurrencyRatesForm rates={currencyRates} />
      </Card>

      <CategoriesManager categories={categories} />

      {/* Abonnement — affichage seul, aucun verrouillage (modèle tarifaire non arrêté). */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-indigo-soft text-indigo">
              <CreditCard className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-bold text-label">{t('subscription.title')}</h2>
              <p className="text-xs text-label-3">{t('subscription.note')}</p>
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div className="text-end">
              <p className="text-xs font-semibold uppercase tracking-wide text-label-4">
                {t('subscription.plan')}
              </p>
              <p className="font-bold text-label">{t(`subscription.plans.${subscription.plan}`)}</p>
            </div>
            <div className="text-end">
              <p className="text-xs font-semibold uppercase tracking-wide text-label-4">
                {t('subscription.units')}
              </p>
              <p className="font-bold tabular-nums text-label">{subscription.unitsCount}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Membres du cabinet (F4) — administrateur seulement ; le dernier admin est protégé. */}
      {canManageMembers && org && <MembersManager rows={memberRows} />}
    </div>
  );
}
