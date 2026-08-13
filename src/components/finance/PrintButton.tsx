'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Déclenche l'impression du navigateur. Masqué à l'impression (data-print-hide). */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="primary" onClick={() => window.print()} data-print-hide>
      <Printer className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
