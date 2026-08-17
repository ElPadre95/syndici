import { getTranslations } from 'next-intl/server';
import { Wordmark } from './Wordmark';

/**
 * En-tête de la vitrine (J1) — filet fin, papier, aucune ornementation. Marque à gauche,
 * bascule de langue + connexion + appel à la démonstration à droite (propriétés logiques,
 * donc miroir en arabe). La bascule de langue pointe vers la RACINE de l'autre locale.
 */
export async function SiteHeader({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.nav');
  const other = locale === 'ar' ? 'fr' : 'ar';

  return (
    <header className="border-b" style={{ borderColor: 'var(--line)' }}>
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-6 py-5">
        <a href={`/${locale}`} aria-label="Syndici" className="text-2xl">
          <Wordmark />
        </a>
        <nav className="flex items-center gap-5 text-sm">
          <a
            href={`/${other}`}
            className="v-mono uppercase tracking-wider"
            style={{ color: 'var(--ink-2)', fontSize: '0.72rem' }}
          >
            {t('langLabel')}
          </a>
          <a
            href={`/${locale}/sign-in`}
            className="font-semibold"
            style={{ color: 'var(--ink-2)' }}
          >
            {t('login')}
          </a>
          <a href="#contact" className="v-btn">
            {t('demo')}
          </a>
        </nav>
      </div>
    </header>
  );
}
