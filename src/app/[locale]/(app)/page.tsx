import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { getSessionContext } from '@/server/session';
import { listResidentAttachments } from '@/server/residents/home';
import { listAnnouncementsForResident } from '@/server/announcements/data';
import { listResidenceDocuments } from '@/server/documents/data';
import { signedFilePath } from '@/server/storage/sign';
import { getStaffDashboard } from '@/server/finance/dashboard';
import { listResidencePayments } from '@/server/finance/payments';
import { listExpenses } from '@/server/finance/expenses';
import { listContracts } from '@/server/finance/contracts';
import { ResidentHome } from '@/components/app/ResidentHome';
import { OwnerHome } from '@/components/app/OwnerHome';
import { StaffDashboard } from '@/components/app/StaffDashboard';

/**
 * Page d'accueil. Selon le profil :
 *   - staff avec une résidence ACTIVE → tableau de bord sobre (lots, collecte, impayés) ;
 *   - résident rattaché → accueil sobre, informatif (A7 §1), jamais l'invite syndic ;
 *   - compte SANS aucune résidence → l'onboarding « créer une résidence » (A1).
 *
 * « Premiers pas » ne s'affiche donc que si la personne n'a réellement aucune résidence.
 */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('app.dashboard');
  const ctx = await getSessionContext();
  const name = ctx?.userLabel ?? null;

  // Résident (ni syndic ni gestionnaire) rattaché à au moins un lot : vue réduite.
  if (ctx && !ctx.isStaff) {
    const attachments = await listResidentAttachments(ctx.personId);
    if (attachments.length > 0) {
      const rctx =
        ctx.activeId && ctx.role
          ? { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role }
          : null;
      const tDoc = await getTranslations('documents.f3');
      const [announcements, docs] = await Promise.all([
        rctx ? listAnnouncementsForResident(rctx) : Promise.resolve([]),
        rctx ? listResidenceDocuments(rctx) : Promise.resolve([]),
      ]);
      const documents = docs.map((d) => ({
        id: d.id,
        name: d.name,
        typeLabel: tDoc(`type.${d.type}`),
        href: signedFilePath(d.fileAssetId, 3600),
      }));

      // PROPRIÉTAIRE → espace propriétaire (G1). LOCATAIRE (ou rôle indéterminé) → accueil
      // sobre inchangé. La différenciation est par le RÔLE : un locataire n'atteint jamais
      // l'espace propriétaire.
      if (rctx && rctx.role === 'PROPRIETAIRE') {
        const residenceName =
          ctx.residences.find((r) => r.id === ctx.activeId)?.name ??
          attachments[0]?.residence ??
          '';
        return (
          <OwnerHome
            ctx={rctx}
            name={name}
            residenceName={residenceName}
            announcements={announcements}
            documents={documents}
          />
        );
      }

      return (
        <ResidentHome
          name={name}
          attachments={attachments}
          announcements={announcements}
          documents={documents}
        />
      );
    }
  }

  // Staff avec une résidence active : tableau de bord utile, pas « Premiers pas ».
  const activeResidence = ctx?.residences.find((r) => r.id === ctx.activeId) ?? null;
  if (ctx?.isStaff && ctx.activeId && ctx.role && activeResidence) {
    const actx = { personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role };
    // Page d'accueil : chargée à chaque connexion → les 4 lectures sont parallélisées.
    // (`getStaffDashboard` regroupe déjà ses agrégats internes ; on n'en refait aucun.)
    const [data, payments, expenses, contracts] = await Promise.all([
      getStaffDashboard(actx),
      listResidencePayments(actx),
      listExpenses(actx, { includeInternal: true }),
      listContracts(actx),
    ]);
    return (
      <StaffDashboard
        name={name}
        residenceName={activeResidence.name}
        data={data}
        payments={payments}
        expenses={expenses}
        contracts={contracts}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo">
          {t('sectionLabel')}
        </p>
        <h1 className="text-3xl font-extrabold text-label">
          {name ? t('welcome', { name }) : t('welcomeGuest')}
        </h1>
        {!name && <p className="mt-2 text-sm text-label-3">{t('subtitleGuest')}</p>}
      </header>

      <Card>
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-indigo-soft text-indigo">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-label">{t('getStartedTitle')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-label-3">{t('getStartedBody')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/residences">
                <Button variant="primary">
                  {t('createResidence')}
                  <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </Button>
              </Link>
              <Link href="/residences">
                <Button variant="secondary">{t('viewResidences')}</Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
