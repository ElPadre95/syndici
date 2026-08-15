import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app/AppSidebar';
import { AppHeader } from '@/components/app/AppHeader';
import { MessagingBubble } from '@/components/app/MessagingBubble';
import { getAuthState } from '@/server/session';
import { unreadCount } from '@/server/messaging/data';

/**
 * Coquille de l'application connectée (A1/A2). Layout serveur : il est l'AUTORITÉ sur la
 * validité de la session. Une session dont l'identité n'est plus résoluble (`personId`
 * périmé après un rechargement des données de démo, compte non lié) n'est JAMAIS rendue
 * en coquille vide silencieuse : elle est renvoyée vers la connexion avec un message clair.
 * Une session `active` (même sans résidence — onboarding) est rendue normalement.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const state = await getAuthState();

  if (state.status !== 'active') {
    // Session périmée/non résoluble → connexion, avec un motif explicite (le silence
    // était le vrai défaut). L'anonyme ne devrait pas arriver ici (middleware), mais on
    // le renvoie aussi plutôt que de rendre une coquille.
    const reason = state.status === 'stale' ? '?reason=session_invalide' : '';
    redirect(`/${locale}/sign-in${reason}`);
  }

  const ctx = state.context;
  // Coquille selon le rôle : staff (syndic), propriétaire (espace G), sinon locataire
  // (vue réduite). Ajouter le locataire plus tard = différenciation par les droits, pas
  // une refonte de la coquille.
  const variant = ctx.isStaff ? 'staff' : ctx.role === 'PROPRIETAIRE' ? 'owner' : 'tenant';
  // Compteur de non-lus pour la bulle : uniquement quand il y a une résidence active et un
  // rôle (le locataire n'a pas de bulle, mais on évite tout appel inutile).
  const unread =
    ctx.activeId && ctx.role && variant !== 'tenant'
      ? await unreadCount({ personId: ctx.personId, residenceId: ctx.activeId, role: ctx.role })
      : 0;
  return (
    <div className="min-h-screen bg-bg lg:flex">
      <AppSidebar variant={variant} />
      <div className="flex min-h-screen flex-1 flex-col">
        <AppHeader
          userLabel={ctx.userLabel}
          residences={ctx.residences.map((r) => ({ id: r.id, name: r.name }))}
          activeId={ctx.activeId}
        />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
      <MessagingBubble variant={variant} unread={unread} />
    </div>
  );
}
