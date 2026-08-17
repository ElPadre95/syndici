import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/vitrine/SiteHeader';
import { Hero } from '@/components/vitrine/Hero';
import { SoftDivider } from '@/components/vitrine/SoftDivider';
import { Problem } from '@/components/vitrine/Problem';
import { Product } from '@/components/vitrine/Product';
import { OwnerTransparency } from '@/components/vitrine/OwnerTransparency';
import { Proofs } from '@/components/vitrine/Proofs';
import { Pricing } from '@/components/vitrine/Pricing';
import { Faq } from '@/components/vitrine/Faq';
import { Contact } from '@/components/vitrine/Contact';
import { SiteFooter } from '@/components/vitrine/SiteFooter';

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

  // Fonds alternés (blanc / panneau léger) reliés par des séparateurs SOUPLES — l'aération et
  // les bandes de fond structurent la page, plus aucun filet ni réglette (direction manuscrite).
  const white = 'var(--white)';
  const panel = 'var(--panel)';
  const dark = 'var(--dark)';

  return (
    <>
      <SiteHeader locale={locale} />
      <main>
        <Hero locale={locale} />
        {/* L'ouverture se termine déjà par une courbe vers le panneau → Problème (panneau). */}
        <Problem />
        <SoftDivider from={panel} to={white} variant="a" />
        <Product locale={locale} />
        <SoftDivider from={white} to={panel} variant="b" />
        <OwnerTransparency locale={locale} />
        <SoftDivider from={panel} to={white} variant="a" />
        <Proofs locale={locale} />
        <SoftDivider from={white} to={panel} variant="b" />
        <Pricing />
        <SoftDivider from={panel} to={white} variant="a" />
        <Faq />
        <SoftDivider from={white} to={panel} variant="b" />
        {/* Section 8 — la conversion. Porte l'ancre #contact (cible de tous les CTA). */}
        <Contact />
        <SoftDivider from={panel} to={dark} variant="a" />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
