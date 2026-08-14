import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Surface carte — primitive du système (R1). Filet net (`border-sep`) + ombre discrète.
 * Rembourrage par défaut confortable, surchargé par `className` (densité par écran).
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-sep bg-card p-5 shadow-sm', className)}
      {...props}
    />
  );
}
