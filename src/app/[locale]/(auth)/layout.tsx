import { LocaleSwitcher } from '@/components/LocaleSwitcher';

/** Cadre commun aux écrans d'authentification (design provisoire). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-end">
          <LocaleSwitcher />
        </div>
        <div className="rounded-lg border border-sep bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
