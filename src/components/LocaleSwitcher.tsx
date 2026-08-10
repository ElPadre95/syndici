'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/**
 * Switches the active locale while keeping the current path. Uses the locale-aware
 * router from next-intl so fr <-> ar preserves the page. This is the mechanism the
 * foundations screen uses to demonstrate full RTL layout inversion.
 */
export function LocaleSwitcher() {
  const activeLocale = useLocale();
  const t = useTranslations('locale');
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      role="group"
      aria-label={t('switchLabel')}
      className="inline-flex items-center gap-1 rounded-md bg-bg p-1"
    >
      <Languages className="mx-1 size-4 text-label-3" aria-hidden />
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          aria-pressed={loc === activeLocale}
          onClick={() => router.replace(pathname, { locale: loc })}
          className={cn(
            'rounded-sm px-3 py-1 text-sm font-semibold transition-colors',
            loc === activeLocale
              ? 'bg-white text-label shadow-sm'
              : 'text-label-3 hover:text-label',
          )}
        >
          {t(loc)}
        </button>
      ))}
    </div>
  );
}
