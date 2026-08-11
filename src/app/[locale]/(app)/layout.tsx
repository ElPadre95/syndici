import { AppSidebar } from '@/components/app/AppSidebar';
import { AppHeader } from '@/components/app/AppHeader';
import { getSessionContext } from '@/server/session';

/**
 * Coquille de l'application connectée (A1/A2). Layout serveur : résout le contexte
 * de session (identité, résidences accessibles, résidence active) et le transmet à
 * l'en-tête. Les routes sont déjà gardées par le middleware ; ce layout ne rend donc
 * que pour un utilisateur authentifié.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();

  return (
    <div className="flex min-h-screen bg-bg">
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <AppHeader
          userLabel={ctx?.userLabel ?? null}
          residences={ctx?.residences.map((r) => ({ id: r.id, name: r.name })) ?? []}
          activeId={ctx?.activeId ?? null}
        />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
