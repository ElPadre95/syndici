'use client';

import { useState, useTransition } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { setActiveResidenceAction } from '@/server/residences/actions';
import { cn } from '@/lib/cn';

export interface SwitcherResidence {
  id: string;
  name: string;
}

/**
 * Sélecteur de résidence active dans l'en-tête (§4). Le choix est persisté côté
 * serveur (cookie) via une action ; tous les écrans suivants sont scopés dessus.
 * Cas normal d'un cabinet gérant plusieurs résidences.
 */
export function ResidenceSwitcher({
  residences,
  activeId,
}: {
  residences: SwitcherResidence[];
  activeId: string | null;
}) {
  const t = useTranslations('residences.switcher');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const active = residences.find((r) => r.id === activeId) ?? null;

  function select(id: string) {
    setOpen(false);
    if (id === activeId) return;
    startTransition(async () => {
      await setActiveResidenceAction(id);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-sep bg-white px-3 py-1.5 text-sm font-semibold text-label hover:bg-bg"
      >
        <Building2 className="size-4 text-label-3" aria-hidden />
        <span className="max-w-[12rem] truncate">{active ? active.name : t('none')}</span>
        <ChevronDown className="size-4 text-label-4" aria-hidden />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('label')}
          className="absolute end-0 z-10 mt-1 max-h-72 w-64 overflow-auto rounded-md border border-sep bg-white py-1 shadow-md"
        >
          {residences.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                role="option"
                aria-selected={r.id === activeId}
                onClick={() => select(r.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-bg',
                  r.id === activeId ? 'font-semibold text-indigo' : 'text-label',
                )}
              >
                <Check
                  className={cn('size-4 shrink-0', r.id === activeId ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
                <span className="truncate">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
