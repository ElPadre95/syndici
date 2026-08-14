'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages, Check, ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/**
 * Sélecteur de langue — MENU compact (R1), conçu pour accueillir QUATRE langues
 * (fr, en, ar, nl) sans s'élargir : un déclencheur discret + une liste déroulante,
 * plutôt que des boutons côte à côte. Ne rend que `routing.locales` (fr, ar aujourd'hui) ;
 * ajouter en/nl est un travail d'i18n (routing + catalogues), hors de la refonte visuelle.
 * Fermeture au clic extérieur et à Échap ; alignement logique (survit au RTL).
 */
export function LocaleSwitcher() {
  const activeLocale = useLocale();
  const t = useTranslations('locale');
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (loc: string) => {
    setOpen(false);
    if (loc !== activeLocale) router.replace(pathname, { locale: loc });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('switchLabel')}
        className="inline-flex items-center gap-1.5 rounded-md border border-sep bg-card px-2.5 py-1.5 text-note font-semibold text-label-2 transition-colors hover:bg-bg"
      >
        <Languages className="size-4 text-label-3" aria-hidden />
        <span className="uppercase">{activeLocale}</span>
        <ChevronDown
          className={cn('size-3.5 text-label-4 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 z-30 mt-1 min-w-36 overflow-hidden rounded-md border border-sep bg-card py-1 shadow-md"
        >
          {routing.locales.map((loc) => (
            <button
              key={loc}
              type="button"
              role="menuitemradio"
              aria-checked={loc === activeLocale}
              onClick={() => choose(loc)}
              className={cn(
                'flex w-full items-center justify-between gap-3 px-3 py-2 text-body transition-colors hover:bg-bg',
                loc === activeLocale ? 'font-bold text-indigo' : 'text-label-2',
              )}
            >
              <span>{t(loc)}</span>
              {loc === activeLocale && <Check className="size-4" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
