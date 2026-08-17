import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/vitrine/SiteHeader';
import { Hero } from '@/components/vitrine/Hero';
import { LotRuler } from '@/components/vitrine/LotRuler';

/**
 * Vitrine publique (J1). Servie à la RACINE pour un visiteur anonyme (réécriture middleware).
 * Section d'ouverture d'abord ; les autres sections viendront une fois la direction validée.
 */

// Base d'URL dérivée de l'environnement : passage à un vrai domaine = variable, aucun code.
const siteBase =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'vitrine.hero' });
  const title = `Syndici — ${t('title1')} ${t('title2')}`;
  const description = t('lead');
  return {
    metadataBase: siteBase ? new URL(siteBase) : undefined,
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale,
      images: [{ url: `/marketing/transparence-${locale === 'ar' ? 'ar' : 'fr'}.png`, width: 2880, height: 1920 }],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function VitrinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('vitrine');

  return (
    <>
      <SiteHeader locale={locale} />
      <main>
        <Hero locale={locale} />
        {/* Réglette de lots — séparateur de signature entre les sections. */}
        <LotRuler label={t('ruler')} />
      </main>
      {/* Cible de l'appel à l'action ; la section Contact complète arrivera avec les autres. */}
      <div id="contact" aria-hidden />
    </>
  );
}
