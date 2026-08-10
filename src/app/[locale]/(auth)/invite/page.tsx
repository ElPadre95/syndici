import { setRequestLocale } from 'next-intl/server';
import { InviteForm } from '@/components/auth/InviteForm';

export default async function InvitePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InviteForm />;
}
