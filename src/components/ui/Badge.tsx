import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE: Record<Tone, string> = {
  neutral: 'bg-bg text-label-3',
  success: 'bg-green-soft text-green',
  warning: 'bg-orange-soft text-orange',
  danger: 'bg-red-soft text-red',
  info: 'bg-indigo-soft text-indigo',
};

/** Badge de statut — primitive du système (R1). Tons = rôles sémantiques stricts. */
export function Badge({
  tone = 'neutral',
  className,
  ...props
}: { tone?: Tone } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-note font-bold',
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}
