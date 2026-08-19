import { getTranslations } from 'next-intl/server';
import { Wordmark } from './Wordmark';
import { LangMenu } from '@/components/LangMenu';
import { AccessMenu } from './AccessMenu';
import { MobileNav } from './MobileNav';

/**
 * Barre de navigation (J) — fond sombre #0B1220, DISCRÈTE (~56px bureau, ~52px mobile).
 * À gauche : la marque + trois liens de section (Fonctionnalités, Transparence, Tarifs), en
 * corps de texte, jamais en gras. À droite, dans l'ordre : « Demander une démo », « Me
 * connecter » (menu des deux espaces), puis le globe des langues. Sur mobile, les trois liens
 * et l'accès passent dans un menu replié ; la démo et le globe restent visibles. Propriétés
 * logiques → miroir RTL complet (la marque passe à la fin, les actions au début en arabe).
 */
export async function SiteHeader({ locale }: { locale: string }) {
  const t = await getTranslations('vitrine.nav');
  const sections = [
    { href: '#fonctionnalites', label: t('features') },
    { href: '#transparence', label: t('transparency') },
    { href: '#tarifs', label: t('pricing') },
  ];

  return (
    <header style={{ background: 'var(--dark)', borderBottom: '1px solid var(--line-dark)' }}>
      <div className="mx-auto flex h-[52px] max-w-[1280px] items-center justify-between gap-4 px-6 lg:h-14">
        {/* Marque + liens de section (liens masqués sur mobile) */}
        <div className="flex items-center gap-7">
          <a href={`/${locale}`} aria-label="Syndici" className="text-lg" style={{ color: '#fff' }}>
            <Wordmark />
          </a>
          <nav className="hidden items-center gap-6 text-sm lg:flex">
            {sections.map((s) => (
              <a key={s.href} href={s.href} className="transition-colors hover:text-white" style={{ color: '#c3ccd9' }}>
                {s.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Actions : démo · me connecter · globe (me connecter → menu replié sur mobile) */}
        <div className="flex items-center gap-3 lg:gap-5">
          <a href="#contact" className="v-btn-sm">
            {t('demo')}
          </a>
          <div className="hidden lg:block">
            <AccessMenu locale={locale} />
          </div>
          <LangMenu locale={locale} tone="onDark" languageLabel={t('language')} soonLabel={t('soon')} />
          <div className="lg:hidden">
            <MobileNav locale={locale} sections={sections} />
          </div>
        </div>
      </div>
    </header>
  );
}
