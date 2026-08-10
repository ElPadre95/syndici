import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale, getTranslations } from 'next-intl/server';
import { Plus_Jakarta_Sans, DM_Serif_Display, Noto_Sans_Arabic } from 'next/font/google';
import { routing, getDirection } from '@/i18n/routing';
import '@/styles/tokens.css';
import './globals.css';

// The two families used by the prototype (Latin). next/font injects the runtime CSS
// variables that tokens.css composes into --font-sans / --font-serif.
const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans-src',
  display: 'swap',
});

const fontSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif-src',
  display: 'swap',
});

// Arabic face. The prototype already specified 'Noto Sans Arabic' in its language
// switch; Plus Jakarta Sans carries no Arabic glyphs. tokens.css leads the font
// stack with this variable for the `ar` locale (:root[lang='ar']).
const fontArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-arabic-src',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return {
    title: t('appName'),
    description: t('tagline'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for this locale.
  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = getDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${fontSans.variable} ${fontSerif.variable} ${fontArabic.variable}`}
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
