import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware navigation primitives. Use these (never next/link, next/navigation
 * directly) so links and redirects always carry the active locale.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
