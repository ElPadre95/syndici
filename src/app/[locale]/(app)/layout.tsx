import { auth } from '@/auth';
import { AppSidebar } from '@/components/app/AppSidebar';
import { AppHeader } from '@/components/app/AppHeader';

/**
 * Coquille de l'application connectée (A1). Layout serveur : lit la session
 * (`auth()`) et transmet l'identité + le nombre de résidences accessibles à
 * l'en-tête. La navigation latérale et le sélecteur de langue sont des composants
 * clients autonomes. Design provisoire.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userLabel = session?.user?.name ?? session?.user?.email ?? null;
  const residencesCount = session?.accessibleResidences?.length ?? 0;

  return (
    <div className="flex min-h-screen bg-bg">
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <AppHeader userLabel={userLabel} residencesCount={residencesCount} />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
