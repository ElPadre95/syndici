import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * État vide — primitive du système (R1). Jamais une page blanche : une icône neutre, un
 * titre, une explication, et une action facultative.
 */
export function EmptyState({
  Icon,
  title,
  body,
  action,
}: {
  Icon?: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-card px-6 py-16 text-center">
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <p className="text-section font-bold text-label">{title}</p>
      {body && <p className="max-w-sm text-body text-label-3">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
