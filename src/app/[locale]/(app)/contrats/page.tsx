import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { ContractsPanel } from '@/components/finance/ContractsPanel';
import { getSessionContext } from '@/server/session';
import { can } from '@/server/auth/permissions';
import { listContracts } from '@/server/finance/contracts';

/**
 * Contrats fournisseurs (C3). Échéances triées (la plus proche/dépassée d'abord),
 * compte à rebours et alerte visuelle DÉRIVÉS de la date réelle (SPEC §7.2). Réservé
 * au staff (`contract.view`) ; saisie/archivage sous `contract.manage`.
 */
export default async function ContratsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contracts');

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
  if (!can(ctx.role, 'contract.view')) {
    return (
      <p className="mx-auto max-w-3xl rounded-md bg-orange-soft px-3 py-2 text-sm text-orange">
        {t('forbidden')}
      </p>
    );
  }

  const contracts = await listContracts({
    personId: ctx.personId,
    residenceId: ctx.activeId,
    role: ctx.role,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <ContractsPanel contracts={contracts} canManage={can(ctx.role, 'contract.manage')} />
    </div>
  );
}
