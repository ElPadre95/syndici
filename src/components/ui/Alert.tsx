import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'danger' | 'warning' | 'success' | 'info';

const TONE: Record<Tone, { cls: string; Icon: LucideIcon }> = {
  danger: { cls: 'bg-red-soft text-red', Icon: AlertCircle },
  warning: { cls: 'bg-orange-soft text-orange', Icon: AlertTriangle },
  success: { cls: 'bg-green-soft text-green', Icon: CheckCircle2 },
  info: { cls: 'bg-indigo-soft text-indigo', Icon: Info },
};

/**
 * Message en ligne (erreur / alerte / succès) — primitive du système (R1). Icône par
 * défaut selon le ton ; le texte vient toujours des catalogues (aucun contenu ici).
 */
export function Alert({
  tone = 'danger',
  icon = true,
  children,
  className,
}: {
  tone?: Tone;
  icon?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { cls, Icon } = TONE[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-body font-semibold',
        cls,
        className,
      )}
    >
      {icon && <Icon className="size-4 shrink-0" aria-hidden />}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
