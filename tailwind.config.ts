import type { Config } from 'tailwindcss';

/**
 * The design tokens live in `src/styles/tokens.css` as CSS custom properties
 * (single source of truth, extracted from the audited prototype). Tailwind only
 * references them here so nothing is duplicated. The design is PROVISIONAL and
 * will be reworked at the end of the project (see DECISIONS.md).
 *
 * `reference/` is intentionally NOT in `content`: it must never leak into the build.
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
        label: {
          DEFAULT: 'var(--label)',
          2: 'var(--label-2)',
          3: 'var(--label-3)',
          4: 'var(--label-4)',
        },
        sep: 'var(--sep)',
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
      },
      boxShadow: {
        sm: 'var(--sh-sm)',
        md: 'var(--sh-md)',
      },
      spacing: {
        sidebar: 'var(--sw)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        serif: 'var(--font-serif)',
      },
    },
  },
  plugins: [],
};

export default config;
