import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Classe partagée des contrôles de saisie (champ, sélecteur) — filet net, focus global. */
export const CONTROL_CLASS =
  'w-full rounded-md border border-sep bg-card px-3 py-2 text-body text-label placeholder:text-label-4 disabled:opacity-50';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

/**
 * Champ étiqueté — primitive du système (R1). Étiquette + saisie + aide/erreur.
 * `forwardRef` pour rester utilisable en formulaire non contrôlé.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, className, ...props },
  ref,
) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-note font-semibold text-label-2">{label}</span>}
      <input
        ref={ref}
        className={cn(CONTROL_CLASS, error ? 'border-red' : null, className)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? (
        <span className="text-note font-medium text-red">{error}</span>
      ) : hint ? (
        <span className="text-note text-label-4">{hint}</span>
      ) : null}
    </label>
  );
});
