/**
 * Logotype (J1) — le mot « Syndici » et son point d'accent, travaillé typographiquement
 * (Fraunces). Composant isolé : un vrai logo (SVG) pourra le remplacer ici sans toucher au
 * reste de la vitrine. Le point est LE seul endroit où l'accent apparaît dans la marque.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`v-display inline-flex items-baseline leading-none ${className}`}
      style={{ fontWeight: 600 }}
    >
      <span style={{ color: 'var(--ink)' }}>Syndici</span>
      <span aria-hidden style={{ color: 'var(--accent)' }}>.</span>
    </span>
  );
}
