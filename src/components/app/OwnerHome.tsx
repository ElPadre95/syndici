import { getTranslations } from 'next-intl/server';
import { Newspaper, FileText, Download, Users2, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { AnnouncementList } from '@/components/announcements/AnnouncementList';
import { OwnerLotPanel, type OwnerLotView } from '@/components/app/OwnerLotPanel';
import type { ResidentDocument } from '@/components/app/ResidentHome';
import type { ActiveContext } from '@/server/auth/context';
import type { AnnouncementView } from '@/server/announcements/data';
import {
  listOwnerLots,
  getOwnerLotCharges,
  getResidenceCollectionCounts,
  summarizeCharges,
} from '@/server/finance/owner';

/**
 * Accueil du PROPRIÉTAIRE (G1) — « où j'en suis ». Sa situation de paiement par lot (le cas
 * MRE multi-lots), l'indicateur collectif de la résidence (des NOMBRES, jamais d'identité),
 * puis ses actualités et documents (déjà câblés E3/F3). Réservé au rôle PROPRIETAIRE
 * (gating dans la page) — un locataire garde son accueil sobre et n'atteint jamais cet écran.
 */
export async function OwnerHome({
  ctx,
  name,
  residenceName,
  announcements,
  documents,
}: {
  ctx: ActiveContext;
  name: string | null;
  residenceName: string;
  announcements: AnnouncementView[];
  documents: ResidentDocument[];
}) {
  const t = await getTranslations('owner');

  const lots = await listOwnerLots(ctx);
  const [chargesByLot, counts] = await Promise.all([
    Promise.all(lots.map((l) => getOwnerLotCharges(ctx, l.lotId))),
    getResidenceCollectionCounts(ctx),
  ]);

  const lotViews: OwnerLotView[] = lots.map((l, i) => {
    const s = summarizeCharges(chargesByLot[i]!);
    return {
      lotId: l.lotId,
      reference: l.reference,
      isChargePayer: l.isChargePayer,
      totalRemainingMinor: s.totalRemainingMinor,
      nextDueDate: s.nextDueDate,
      maxDaysLate: s.maxDaysLate,
      overdue: s.overdue,
      settledAll: s.settledAll,
    };
  });

  const allPaid = counts.totalLots > 0 && counts.pendingCount === 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-eyebrow font-bold uppercase text-indigo">{residenceName}</p>
        <h1 className="text-title text-label">
          {name ? t('welcome', { name }) : t('welcomeGeneric')}
        </h1>
      </header>

      {/* Situation de paiement (par lot) */}
      {lotViews.length > 0 && <OwnerLotPanel lots={lotViews} />}

      {/* Indicateur collectif — des NOMBRES seulement */}
      {counts.totalLots > 0 && (
        <Card className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-indigo-soft text-indigo">
            {allPaid ? (
              <CheckCircle2 className="size-6" aria-hidden />
            ) : (
              <Users2 className="size-6" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-eyebrow font-bold uppercase text-label-4">{t('collectiveTitle')}</p>
            {allPaid ? (
              <p className="mt-0.5 text-section font-bold text-green">{t('collectiveAll')}</p>
            ) : (
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-body">
                <span className="font-bold text-green">
                  {t('collectivePaid', { count: counts.paidCount })}
                </span>
                <span className="text-label-4" aria-hidden>
                  ·
                </span>
                <span className="font-bold text-orange">
                  {t('collectivePending', { count: counts.pendingCount })}
                </span>
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Actualités (audience déjà filtrée) */}
      {announcements.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-section font-bold text-label">
            <Newspaper className="size-4 text-indigo" aria-hidden />
            {t('newsTitle')}
          </h2>
          <AnnouncementList items={announcements} />
        </section>
      )}

      {/* Documents « de toute la résidence » */}
      {documents.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-section font-bold text-label">
            <FileText className="size-4 text-indigo" aria-hidden />
            {t('docsTitle')}
          </h2>
          <ul className="flex flex-col gap-2">
            {documents.map((d) => (
              <li key={d.id}>
                <a
                  href={d.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md border border-sep bg-card px-3 py-2 text-body transition-colors hover:border-indigo"
                >
                  <FileText className="size-4 shrink-0 text-indigo" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-label">{d.name}</span>
                    <span className="text-note text-label-4">{d.typeLabel}</span>
                  </span>
                  <Download className="size-4 shrink-0 text-label-4" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
