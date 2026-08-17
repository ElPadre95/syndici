'use client';

import { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Sélecteur de langue (J1) — icône globe + menu déroulant, conçu pour QUATRE langues (fr, ar,
 * en, nl). Seules fr et ar sont câblées (routes existantes) ; en/nl sont affichées « bientôt ».
 * Le menu pointe vers la RACINE de la locale (la vitrine y est servie).
 */
const LANGS = [
  { code: 'fr', name: 'Français', on: true },
  { code: 'ar', name: 'العربية', on: true },
  { code: 'en', name: 'English', on: false },
  { code: 'nl', name: 'Nederlands', on: false },
];

export function LangMenu({ locale }: { locale: string }) {
  const t = useTranslations('vitrine.nav');
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('language')}
        aria-expanded={open}
        className="flex items-center gap-1.5"
        style={{ color: '#c3ccd9' }}
      >
        <Globe className="size-4" aria-hidden />
        <span className="v-mono text-[0.72rem] uppercase">{locale}</span>
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
            className="absolute z-50 mt-2 min-w-[190px] end-0"
            style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '4px' }}
          >
            {LANGS.map((l) =>
              l.on ? (
                <a
                  key={l.code}
                  href={`/${l.code}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[color:var(--panel)]"
                  style={{ color: 'var(--ink)' }}
                >
                  <span>{l.name}</span>
                  {l.code === locale && <Check className="size-4" style={{ color: 'var(--accent)' }} aria-hidden />}
                </a>
              ) : (
                <span
                  key={l.code}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                  style={{ color: 'var(--ink-3)' }}
                >
                  <span>{l.name}</span>
                  <span className="v-mono text-[0.6rem] uppercase tracking-wider">{t('soon')}</span>
                </span>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
