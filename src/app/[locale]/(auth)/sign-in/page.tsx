import { setRequestLocale } from 'next-intl/server';
import { SignInForm } from '@/components/auth/SignInForm';

/** N'accepte qu'un chemin interne (évite les redirections ouvertes). */
function safeCallback(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  return '/';
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { callbackUrl } = await searchParams;
  return <SignInForm callbackUrl={safeCallback(callbackUrl)} />;
}
