# Syndici

SaaS de gestion de copropriété pour le marché marocain, avec une promesse forte de transparence envers
les propriétaires non-résidents (MRE).

> Étape 1 = **fondations uniquement** (i18n, RTL, formatage monétaire, outillage). Aucune fonctionnalité
> métier n'est encore implémentée. Voir `CONVENTIONS.md` et `DECISIONS.md`.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:3000  → redirige vers /fr
```

Locales : `/fr` (défaut) et `/ar` (RTL). La bascule fr → ar **inverse la mise en page**, pas seulement
le sens du texte.

## Scripts

| Script                            | Rôle                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Next.js                                                         |
| `npm run typecheck`               | TypeScript strict, sans émission                                |
| `npm run lint`                    | ESLint (dont la règle RTL `logical-css/no-physical-properties`) |
| `npm run lint:css`                | stylelint (propriétés logiques dans les `.css`)                 |
| `npm run test`                    | Vitest (dont `src/lib/money.test.ts`)                           |
| `npm run check`                   | typecheck + lint + lint:css + test                              |

## Structure

Voir `CONVENTIONS.md` §7. `reference/` est de la documentation en lecture seule (prototype audité +
audit), jamais importée.
