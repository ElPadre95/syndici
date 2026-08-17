import type { CSSProperties } from 'react';

/**
 * Griffonnages DESSINÉS à la main (J) — flèches courbes, cercles au feutre, soulignements.
 * De vrais tracés SVG irréguliers (jamais des icônes ni des emojis), à bouts ronds, qui
 * DÉBORDENT légèrement leur point de départ pour l'effet « tracé d'un geste ». La couleur
 * vient de `currentColor` (classe `.v-ink`) : on la fixe via une variable d'annotation sur le
 * parent. À utiliser avec parcimonie (trois ou quatre par page, pas davantage).
 */

interface InkProps {
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  /** Couleur du tracé (variable d'annotation). Défaut : bleu clair d'annotation. */
  color?: string;
}

/**
 * Boucle au feutre autour d'un mot. DEUX passes légèrement désalignées (le geste repasse et ne
 * se superpose jamais tout à fait → épaisseur qui varie), radii LUMPY (jamais un ovale net),
 * et un DÉBORDEMENT en fin de tracé (elle ne se referme pas exactement). Dimensionner le SVG
 * PLUS GRAND que le mot (via des marges négatives sur le parent) pour laisser de l'air : le
 * tracé longe alors les bords du viewBox et ne croise ni lettre ni signe diacritique.
 */
export function Loop({ className, style, strokeWidth = 3.6, color = 'var(--ann-blue)' }: InkProps) {
  return (
    <svg
      viewBox="0 0 340 208"
      className={className}
      style={{ color, overflow: 'visible', ...style }}
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
      {/* passe principale : lumpy, ouverte, qui déborde le départ puis file vers l'intérieur */}
      <path
        className="v-ink"
        strokeWidth={strokeWidth}
        d="M319 104C325 52 258 24 168 22 96 20 24 36 15 96 7 150 66 186 172 187 268 188 330 160 320 100 316 74 302 58 276 47"
      />
      {/* seconde passe : radii différents, plus fine et atténuée → l'écart crée l'épaisseur */}
      <path
        className="v-ink"
        strokeWidth={strokeWidth - 1.3}
        style={{ opacity: 0.5 }}
        d="M308 118C317 64 252 40 170 39 104 38 34 48 26 102 19 150 78 178 176 176 258 174 314 152 303 106"
      />
    </svg>
  );
}

/** Soulignement au feutre — légèrement ondulé, repassé une seconde fois (deux tracés). */
export function Underline({
  className,
  style,
  strokeWidth = 3.6,
  color = 'var(--ann-amber)',
}: InkProps) {
  return (
    <svg
      viewBox="0 0 320 26"
      className={className}
      style={{ color, overflow: 'visible', ...style }}
      aria-hidden
      focusable="false"
      preserveAspectRatio="none"
    >
      <path
        className="v-ink"
        strokeWidth={strokeWidth}
        d="M8 14C64 7 128 19 190 11 244 5 286 15 313 10"
      />
      <path
        className="v-ink"
        strokeWidth={strokeWidth - 1.4}
        style={{ opacity: 0.55 }}
        d="M14 19C74 13 132 22 196 16 250 11 288 18 309 15"
      />
    </svg>
  );
}

/** Flèche courbe avec pointe (deux petits traits). Oriente-la par rotation/miroir depuis le parent. */
export function Arrow({ className, style, strokeWidth = 3, color = 'var(--ann-green)' }: InkProps) {
  return (
    <svg
      viewBox="0 0 150 128"
      className={className}
      style={{ color, overflow: 'visible', ...style }}
      aria-hidden
      focusable="false"
    >
      {/* hampe qui s'incurve */}
      <path className="v-ink" strokeWidth={strokeWidth} d="M14 12C33 44 47 62 74 82 92 95 112 103 132 108" />
      {/* pointe : deux traits légèrement asymétriques */}
      <path className="v-ink" strokeWidth={strokeWidth} d="M132 108 108 106M132 108 121 86" />
    </svg>
  );
}
