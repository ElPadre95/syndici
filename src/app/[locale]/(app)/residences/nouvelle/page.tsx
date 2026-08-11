import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ResidenceForm } from '@/components/residences/ResidenceForm';

export default async function NewResidencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('residences.form');
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-extrabold text-label">{t('title')}</h1>
      <ResidenceForm />
    </div>
  );
}
