/**
 * Minimal className combiner (no external dependency). Filters falsy values so
 * conditional classes read cleanly: cn('base', isActive && 'active').
 *
 * The logical-css ESLint rule inspects string arguments to cn(), so physical
 * directional utilities are caught here too.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
