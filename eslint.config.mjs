import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';
import logicalCss from './eslint-rules/logical-css.js';

export default tseslint.config(
  {
    // `reference/` is documentation, never source: never lint it, never allow imports from it.
    ignores: ['node_modules/**', '.next/**', 'coverage/**', 'reference/**', 'next-env.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
      'logical-css': logicalCss,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // React 19 + Next: no need to import React in scope.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // ── Foundational hard rules (see CONVENTIONS.md) ──
      'logical-css/no-physical-properties': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/reference/*', '**/reference/**', 'reference/*', 'reference/**'],
              message: 'reference/ is documentation, not source. Never import from it.',
            },
          ],
        },
      ],
    },
  },
  {
    // The local ESLint rule is plain Node ESM.
    files: ['eslint-rules/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
);
