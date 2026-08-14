import type { Config } from 'tailwindcss';

/**
 * Les design tokens vivent dans `src/styles/tokens.css` (variables CSS, source de
 * vérité). Tailwind ne fait que les référencer. `reference/` est volontairement HORS
 * `content` : le prototype ne doit jamais fuiter dans le build.
 *
 * R1 : échelle typographique à RÔLES (eyebrow, note, body, section, title, stat,
 * display) — la taille + l'interlignage + l'interlettrage sont fixés ici ; la graisse
 * et la couleur restent aux composants. Les tailles Tailwind par défaut restent
 * disponibles pour les écrans pas encore recomposés.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: {
          DEFAULT: 'var(--indigo)',
          deep: 'var(--indigo-deep)',
          soft: 'var(--indigo-soft)',
          mid: 'var(--indigo-mid)',
        },
        red: { DEFAULT: 'var(--red)', soft: 'var(--red-soft)' },
        green: { DEFAULT: 'var(--green)', soft: 'var(--green-soft)' },
        orange: { DEFAULT: 'var(--orange)', soft: 'var(--orange-soft)' },
        bg: 'var(--bg)',
        card: 'var(--card)',
        label: {
          DEFAULT: 'var(--label)',
          2: 'var(--label-2)',
          3: 'var(--label-3)',
          4: 'var(--label-4)',
        },
        sep: 'var(--sep)',
      },
      fontSize: {
        // Rôles typographiques (taille · interlignage · interlettrage).
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
        note: ['0.75rem', { lineHeight: '1.1rem' }],
        body: ['0.9375rem', { lineHeight: '1.55rem' }],
        section: ['1.1875rem', { lineHeight: '1.55rem', letterSpacing: '-0.01em' }],
        title: ['1.9375rem', { lineHeight: '2.15rem', letterSpacing: '-0.02em' }],
        stat: ['1.875rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        display: ['2.75rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
      },
      boxShadow: {
        sm: 'var(--sh-sm)',
        md: 'var(--sh-md)',
        indigo: 'var(--sh-indigo)',
      },
      spacing: {
        sidebar: 'var(--sw)',
      },
      backgroundImage: {
        'grad-indigo': 'var(--grad-indigo)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        serif: 'var(--font-serif)',
      },
      keyframes: {
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'popup-in': {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'popup-in': 'popup-in 0.35s cubic-bezier(0.34, 1.4, 0.64, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
