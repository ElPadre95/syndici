import { getTranslations } from 'next-intl/server';
import { Wordmark } from './Wordmark';
import { LangMenu } from './LangMenu';
import { AccessMenu } from './AccessMenu';

/**
 * Bandeau de navigation (J1) — fond sombre #0B1220, dense, filet fin. Marque à gauche (start) ;
 * sélecteur de langue (globe), accès aux DEUX espaces (syndic / propriétaire) et appel à la
 * démonstration à droite (end). Propriétés logiques → miroir complet en arabe.
 */
export async function SiteHeader({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.nav');

  return (
    <header style={{ background: 'var(--dark)', borderBottom: '1px solid var(--line-dark)' }}>
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-4">
        <a href={`/${locale}`} aria-label="Syndici" className="text-xl" style={{ color: '#fff' }}>
          <Wordmark />
        </a>
        <nav className="flex items-center gap-6 text-sm">
          <LangMenu locale={locale} />
          <AccessMenu locale={locale} />
          <a href="#contact" className="v-btn">
            {t('demo')}
          </a>
        </nav>
      </div>
    </header>
  );
}
