import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CONTROL_CLASS } from './Field';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  error?: ReactNode;
}

/**
 * Sélecteur étiqueté — primitive du système (R1). Chevron logique (côté fin, RTL-safe),
 * apparence native neutralisée. `forwardRef` pour l'usage en formulaire.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, children, ...props },
  ref,
) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-note font-semibold text-label-2">{label}</span>}
      <span className="relative flex items-center">
        <select
          ref={ref}
          className={cn(
            CONTROL_CLASS,
            'cursor-pointer appearance-none pe-9',
            error ? 'border-red' : null,
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute end-3 size-4 text-label-4"
          aria-hidden
        />
      </span>
      {error && <span className="text-note font-medium text-red">{error}</span>}
    </label>
  );
});
