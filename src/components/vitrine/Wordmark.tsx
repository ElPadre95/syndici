/**
 * Logotype (J1) — « Syndici » (Archivo 700, interlettrage serré) et son point cobalt.
 * Composant isolé : un vrai logo (SVG) pourra le remplacer ici sans toucher au reste. La
 * couleur du mot est héritée (blanc sur le bandeau sombre, encre ailleurs) ; seul le point
 * porte l'accent.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`v-title inline-flex items-baseline leading-none ${className}`}
      style={{ fontWeight: 700, letterSpacing: '-0.04em' }}
    >
      <span>Syndici</span>
      <span aria-hidden style={{ color: 'var(--accent)' }}>
        .
      </span>
    </span>
  );
}
