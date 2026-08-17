'use client';

import { useState } from 'react';
import { ChevronDown, Building2, UserCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Accès à la connexion (J1) — présente visiblement les DEUX espaces (syndic / propriétaire),
 * comme deux mondes, avant même la connexion. Techniquement le rôle vient du compte : les deux
 * entrées mènent à la même page de connexion, mais le visiteur voit qu'il y a deux espaces.
 */
export function AccessMenu({ locale }: { locale: string }) {
  const t = useTranslations('vitrine.nav');
  const [open, setOpen] = useState(false);
  const signIn = `/${locale}/sign-in`;

  const entry = (title: string, desc: string, Icon: typeof Building2) => (
    <a
      href={signIn}
      className="flex items-start gap-3 px-4 py-3 hover:bg-[color:var(--panel)]"
    >
      <Icon className="mt-0.5 size-5 shrink-0" style={{ color: 'var(--accent)' }} aria-hidden />
      <span className="flex flex-col">
        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {title}
        </span>
        <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
          {desc}
        </span>
      </span>
    </a>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 font-medium"
        style={{ color: '#c3ccd9' }}
      >
        {t('access')}
        <ChevronDown className="size-4" aria-hidden />
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
            className="absolute z-50 mt-2 w-[280px] overflow-hidden end-0 divide-y"
            style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '14px', borderColor: 'var(--line)' }}
          >
            {entry(t('syndic'), t('syndicDesc'), Building2)}
            {entry(t('owner'), t('ownerDesc'), UserCircle)}
          </div>
        </>
      )}
    </div>
  );
}
