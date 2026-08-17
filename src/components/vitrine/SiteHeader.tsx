import { getTranslations } from 'next-intl/server';
import { Wordmark } from './Wordmark';

/**
 * Bandeau de navigation (J1) — fond sombre #0B1220, dense, filet fin. Marque à gauche (start),
 * bascule de langue + connexion + appel à la démonstration à droite (end). Propriétés logiques,
 * donc miroir en arabe. La bascule pointe vers la RACINE de l'autre locale.
 */
export async function SiteHeader({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.nav');
  const other = locale === 'ar' ? 'fr' : 'ar';

  return (
    <header style={{ background: 'var(--dark)', borderBottom: '1px solid var(--line-dark)' }}>
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-4">
        <a href={`/${locale}`} aria-label="Syndici" className="text-xl" style={{ color: '#fff' }}>
          <Wordmark />
        </a>
        <nav className="flex items-center gap-6 text-sm">
          <a
            href={`/${other}`}
            className="v-mono uppercase tracking-wider"
            style={{ color: '#8b97ab', fontSize: '0.72rem' }}
          >
            {t('langLabel')}
          </a>
          <a href={`/${locale}/sign-in`} className="font-medium" style={{ color: '#c3ccd9' }}>
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
