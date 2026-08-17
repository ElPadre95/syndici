/**
 * Séparateur SOUPLE (J) — une courbe douce entre deux sections, jamais un trait. La bande
 * prend la couleur de la section du DESSOUS (`to`) et se découpe en vague sur celle du dessus
 * (`from`). Remplace les filets de la direction « instrument » et la réglette de lots. Deux
 * profils de vague alternés (`variant`) pour éviter la répétition mécanique.
 */
export function SoftDivider({
  from = 'var(--white)',
  to = 'var(--panel)',
  variant = 'a',
}: {
  from?: string;
  to?: string;
  variant?: 'a' | 'b';
}) {
  const d =
    variant === 'a'
      ? 'M0 80 L0 40 C 320 6 720 6 1080 34 C 1250 47 1360 52 1440 40 L1440 80 Z'
      : 'M0 80 L0 44 C 200 74 520 78 760 52 C 1010 25 1240 20 1440 46 L1440 80 Z';
  return (
    <div aria-hidden className="relative h-10 lg:h-16" style={{ background: from }}>
      <svg className="absolute inset-x-0 bottom-0 h-full w-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
        <path d={d} fill={to} />
      </svg>
    </div>
  );
}
