import { getTranslations } from 'next-intl/server';
import { Wordmark } from './Wordmark';
import { LangMenu } from './LangMenu';

/**
 * Pied de page (J1) — fond sombre #0B1220, sobre. Marque + accroche, liens vers les DEUX
 * espaces, sélecteur de langue, mention légale mesurée. Filets sur fond sombre (`--line-dark`),
 * propriétés logiques (miroir arabe complet).
 */
export async function SiteFooter({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.footer');
  const year = new Date().getFullYear();
  const links = [
    { href: `/${locale}/sign-in`, label: t('syndic') },
    { href: `/${locale}/sign-in`, label: t('owner') },
  ];

  return (
    <footer style={{ background: 'var(--dark)', borderTop: '1px solid var(--line-dark)' }}>
      <div className="mx-auto max-w-[1280px] px-6 py-14">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <div className="text-xl" style={{ color: '#fff' }}>
              <Wordmark />
            </div>
            <p className="v-hand mt-4 text-2xl leading-tight" style={{ color: '#fff' }}>
              {t('tagline')}
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-x-16 gap-y-8">
            <nav className="flex flex-col gap-3 text-sm">
              {links.map((l) => (
                <a key={l.label} href={l.href} className="hover:underline" style={{ color: '#c3ccd9' }}>
                  {l.label}
                </a>
              ))}
            </nav>
            <div>
              <p className="v-kicker mb-3" style={{ color: '#74839a' }}>
                {t('language')}
              </p>
              <LangMenu locale={locale} />
            </div>
          </div>
        </div>

        <div
          className="mt-12 flex flex-col gap-2 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: '1px solid var(--line-dark)', color: '#74839a' }}
        >
          <p className="max-w-2xl leading-relaxed">{t('legal')}</p>
          <p className="v-mono shrink-0">{t('rights', { year })}</p>
        </div>
      </div>
    </footer>
  );
}
