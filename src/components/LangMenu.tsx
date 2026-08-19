'use client';

import { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Sélecteur de langue PARTAGÉ — icône globe + menu déroulant, conçu pour QUATRE langues
 * (fr, ar, en, nl). Seules fr et ar sont câblées ; en/nl sont affichées « bientôt ».
 * Un seul composant sert la vitrine (fond sombre) ET l'application (en-tête clair) via `tone`.
 *
 * Le changement de langue PRÉSERVE la page courante : chaque langue câblée est un lien
 * next-intl `<Link href={pathname} locale={code}>`, donc on reste sur la même route
 * (fonctionne aussi bien dans l'app que sur la vitrine, où le pathname vaut « / »).
 */
const LANGS = [
  { code: 'fr', name: 'Français', on: true },
  { code: 'ar', name: 'العربية', on: true },
  { code: 'en', name: 'English', on: false },
  { code: 'nl', name: 'Nederlands', on: false },
];

interface LangMenuProps {
  locale: string;
  /** `onDark` : barre/pied de vitrine sombres ; `onLight` : en-tête clair de l'app. */
  tone: 'onDark' | 'onLight';
  languageLabel: string;
  soonLabel: string;
}

export function LangMenu({ locale, tone, languageLabel, soonLabel }: LangMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerColor = tone === 'onDark' ? '#c3ccd9' : 'var(--label-2)';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={languageLabel}
        aria-expanded={open}
        className="flex items-center gap-1.5"
        style={{ color: triggerColor }}
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
                <Link
                  key={l.code}
                  href={pathname}
                  locale={l.code}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[color:var(--panel)]"
                  style={{ color: 'var(--ink)' }}
                >
                  <span>{l.name}</span>
                  {l.code === locale && <Check className="size-4" style={{ color: 'var(--accent)' }} aria-hidden />}
                </Link>
              ) : (
                <span
                  key={l.code}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                  style={{ color: 'var(--ink-3)' }}
                >
                  <span>{l.name}</span>
                  <span className="v-mono text-[0.6rem] uppercase tracking-wider">{soonLabel}</span>
                </span>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
