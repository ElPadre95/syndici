import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionContext } from '@/server/session';
import { Messenger } from '@/components/messaging/Messenger';

/**
 * Messagerie du syndic (G4) — les conversations de la résidence active, groupées par lot,
 * avec le rôle de l'interlocuteur (propriétaire / locataire) visible. Réservé au staff
 * (SYNDIC/GESTIONNAIRE) : le mur (messaging/access) garantit qu'il ne voit que les fils de
 * SA résidence, et un résident n'atteint jamais cet écran (variante de nav « owner »/« tenant »
 * ne l'expose pas, et le contexte non-staff est refusé ci-dessous).
 */
export default async function SyndicMessagingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('messagerie');

  const ctx = await getSessionContext();
  const isStaff = ctx?.role === 'SYNDIC' || ctx?.role === 'GESTIONNAIRE';
  if (!ctx?.activeId || !isStaff) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-md bg-orange-soft px-3 py-2 text-body text-orange">{t('msgAucune')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header>
        <p className="text-eyebrow font-bold uppercase text-indigo">{t('msgConversations')}</p>
        <h1 className="text-title text-label">{t('msgTitle')}</h1>
        <p className="mt-1 text-body text-label-3">{t('msgSubGerant')}</p>
      </header>
      <Messenger mode="staff" />
    </div>
  );
}
