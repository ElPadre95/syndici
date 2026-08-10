import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Primitive surface card. Provisional styling. Uses logical padding only.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg bg-white p-5 shadow-sm', className)} {...props} />;
}
