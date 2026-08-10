import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PagePlaceholder } from '@/components/app/PagePlaceholder';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tNav = await getTranslations('app.nav');
  const t = await getTranslations('app.comingSoon');
  return <PagePlaceholder title={tNav('documents')} note={t('title')} body={t('body')} />;
}
