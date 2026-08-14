import type {
  HTMLAttributes,
  TableHTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

/**
 * Primitives de tableau — système (R1). Densité pensée pour de longues listes (25 lignes) :
 * en-tête discret en capitales, lignes aérées mais compactes, défilement horizontal borné.
 * Alignement TOUJOURS logique (`text-start`/`text-end`) pour survivre au RTL.
 */
export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-sep bg-card shadow-sm">
      <table className={cn('w-full text-body', className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-sep', className)} {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-sep last:border-0', className)} {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-start text-eyebrow font-bold uppercase text-label-4',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle text-label-2', className)} {...props} />;
}
