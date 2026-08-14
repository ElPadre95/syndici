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
  searchParams: Promise<{ callbackUrl?: string | string[]; reason?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { callbackUrl, reason } = await searchParams;
  const reasonValue = Array.isArray(reason) ? reason[0] : reason;
  const notice = reasonValue === 'session_invalide' ? 'session_invalide' : undefined;
  return <SignInForm callbackUrl={safeCallback(callbackUrl)} notice={notice} />;
}
