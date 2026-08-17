'use client';

import { useState } from 'react';
import { Menu, X, Building2, UserCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Menu replié de la vitrine (mobile) — la barre reste discrète : seuls le logo, le bouton
 * « démo » et le globe restent visibles ; les trois liens de section et l'accès aux deux
 * espaces passent ici. Le globe reste sur la barre (déjà compact). Miroir RTL par propriétés
 * logiques (le panneau s'ouvre du côté fin).
 */
export function MobileNav({
  locale,
  sections,
}: {
  locale: string;
  sections: { href: string; label: string }[];
}) {
  const t = useTranslations('vitrine.nav');
  const [open, setOpen] = useState(false);
  const signIn = `/${locale}/sign-in`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('access')}
        className="flex size-9 items-center justify-center rounded-full"
        style={{ color: '#fff' }}
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
          />
          <div
            className="absolute z-50 mt-2 w-[240px] overflow-hidden end-0"
            style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '14px' }}
          >
            <nav className="flex flex-col py-1">
              {sections.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  onClick={() => setOpen(false)}
                  className="px-4 py-2.5 text-sm hover:bg-[color:var(--panel)]"
                  style={{ color: 'var(--ink)' }}
                >
                  {s.label}
                </a>
              ))}
            </nav>
            <div className="px-4 pb-1 pt-2" style={{ borderTop: '1px solid var(--line)' }}>
              <p className="pb-1 pt-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
                {t('access')}
              </p>
            </div>
            <div className="flex flex-col pb-2">
              <a href={signIn} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2 hover:bg-[color:var(--panel)]">
                <Building2 className="size-4 shrink-0" style={{ color: 'var(--accent)' }} aria-hidden />
                <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('syndic')}</span>
              </a>
              <a href={signIn} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2 hover:bg-[color:var(--panel)]">
                <UserCircle className="size-4 shrink-0" style={{ color: 'var(--accent)' }} aria-hidden />
                <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('owner')}</span>
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
