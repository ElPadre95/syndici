import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * Bouton — primitive du système (R1). Variantes de rôle (indigo = action), deux tailles,
 * état de chargement. L'anneau de focus est porté par `:focus-visible` global.
 */
const VARIANT: Record<Variant, string> = {
  primary: 'bg-indigo text-white shadow-sm hover:bg-indigo-deep',
  secondary: 'bg-indigo-soft text-indigo hover:bg-indigo-mid',
  ghost: 'bg-transparent text-label-3 hover:bg-bg hover:text-label',
  subtle: 'border border-sep bg-card text-label-2 hover:bg-bg',
  danger: 'bg-red text-white hover:opacity-90',
};

const SIZE: Record<Size, string> = {
  sm: 'gap-1.5 px-3 py-1.5 text-note',
  md: 'gap-2 px-4 py-2 text-body',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
