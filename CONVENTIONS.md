# Conventions — Syndici

Règles non négociables du projet. Elles sont, autant que possible, **appliquées par l'outillage**
(TypeScript strict, ESLint, stylelint, tests) et pas seulement documentées.

## 1. Nommage

- **Fichiers composants** : `PascalCase.tsx` (`Button.tsx`, `LocaleSwitcher.tsx`).
- **Autres modules TS** : `camelCase.ts` (`money.ts`, `cn.ts`).
- **Helpers / variables / fonctions** : `camelCase`. **Types & composants React** : `PascalCase`.
- **Constantes exportées stables** : `UPPER_SNAKE_CASE` (`CURRENCY`).
- **Clés i18n** : `namespace.cléCamelCase` dans `messages/<locale>.json` (ex. `home.title`).
- **Tokens CSS** : conservés tels quels depuis le prototype (`--indigo`, `--label`, `--r-md`, …).
- **Tests** : `*.test.ts` à côté du fichier testé.

## 2. Zéro texte en dur (i18n)

- **Aucune chaîne visible par l'utilisateur n'est écrite en dur** dans un composant, dès le premier
  composant. Tout passe par `next-intl` (`useTranslations` côté client, `getTranslations` côté serveur)
  et vit dans `messages/<locale>.json`.
- Locales actuelles : `fr` (défaut) et `ar`. La structure accueille `en, nl, es, de` sans refonte
  (voir `src/i18n/routing.ts` → `plannedLocales`).
- Toute nouvelle clé est ajoutée dans **toutes** les locales livrées.

## 3. Argent en entiers de centimes

- **Tout montant est un entier de centimes** (`650 MAD` → `65000`). Jamais de `float`, jamais de
  nombre en unités majeures stocké/transporté.
- **Le formatage ne se fait jamais à la main** dans un composant : toujours `formatMoney()` de
  `src/lib/money.ts` (devise `MAD`, locale-aware). Conversions via `toCentimes()`.
- `formatMoney` **lève une erreur** si on lui passe un non-entier : les floats sont interdits jusque
  dans le typage d'exécution. Couvert par `src/lib/money.test.ts`.

## 4. Propriétés logiques CSS uniquement (RTL)

- **Interdiction des propriétés/utilitaires directionnels physiques.** On écrit :
  - `padding-inline-start` / classes `ps-*` — jamais `padding-left` / `pl-*`
  - `margin-inline-end` / `me-*` — jamais `margin-right` / `mr-*`
  - `inset-inline-start` / `start-*` — jamais `left` / `left-*`
  - `text-align: start` / `text-start` — jamais `left` / `text-left`
  - `border-inline-start` / `border-s` — jamais `border-left` / `border-l`
  - `border-start-start-radius` / `rounded-s` — jamais `border-top-left-radius` / `rounded-l`
- **Appliqué comme ERREUR** par :
  - ESLint : règle locale `logical-css/no-physical-properties` (classes Tailwind dans `className`,
    appels `cn()/clsx()`, et styles inline `style={{}}`).
  - stylelint : `property-disallowed-list` + `declaration-property-value-disallowed-list` pour les
    fichiers `.css`.
- L'attribut `dir` est posé sur `<html>` d'après la locale (`getDirection`) ; la mise en page s'inverse
  d'elle-même parce que tout est logique. On ne bascule jamais `body.style.direction` à la main (c'était
  l'échec du prototype).

## 5. Accès aux données

- **Aucun appel Prisma dans un composant** (ni client, ni serveur de page). Toute lecture/écriture passe
  par `src/server/` (couche d'accès aux données + logique métier serveur).
- La logique métier (montants, statuts, numérotation de reçus, autorisations) vit **côté serveur**, pas
  dans le rendu — correctif structurel identifié par l'audit du prototype.
- (Le modèle de données Prisma fera l'objet d'une étape dédiée ; `src/server/` est déjà réservé.)

## 5 bis. SQL brut : typer explicitement les paramètres

Postgres n'applique **aucune conversion implicite** d'un paramètre `text` vers `timestamp`,
`date`, un `enum`, etc. PGlite (utilisé par le gate) est plus tolérant : un SQL brut mal typé
peut passer les tests et **casser en production**. C'est arrivé une fois :

```ts
// ❌ Cassé sur Postgres réel — PGlite l'acceptait
`INSERT INTO "InvitationCode" (..., "expiresAt", ...) VALUES (..., $6, ...)`
// → ERROR 42804: column "expiresAt" is of type timestamp but expression is of type text

// ✅ Correct — cast explicite sur chaque paramètre non-textuel
`INSERT INTO "InvitationCode" (..., "expiresAt", ...) VALUES (..., $6::timestamp, ...)`;
```

Règle : **dans tout SQL brut** (production _et_ fixtures de test), tout paramètre `$n` visant une
colonne `timestamp` / `date` / un `enum` (ex. `$4::"AttachmentRole"`, `$3::"NumberSeries"`) doit
porter un cast `::type` explicite. Les littéraux dans le texte SQL (`'PENDING'`, `now()`,
`CURRENT_DATE`) n'en ont pas besoin ; les colonnes `text` non plus.

Filet de sécurité : `npm run test:pg` rejoue **les mêmes tests d'invariants** contre un vrai
Postgres (base jetable `<db>_test`, client Prisma dédié qui reproduit le binding de production)
au lieu de PGlite. À lancer quand on touche à du SQL brut : c'est la seule façon de débusquer
cette classe de divergence.

## 6. `reference/` n'est jamais importé

- `reference/` (prototype audité + audit) est de la **documentation**, pas du code source.
- Interdit d'importer quoi que ce soit depuis `reference/`. Garde-fous :
  - `tsconfig.json` → `exclude: ["reference"]`
  - ESLint → `ignores: ['reference/**']` **et** `no-restricted-imports` (pattern `**/reference/**`)
  - `tailwind.config.ts` `content` n'inclut pas `reference/`
  - `.prettierignore` / `.stylelintrc.json` ignorent `reference/`

## 7. Structure des dossiers

```
src/app/[locale]/     routes localisées (layout pose <html lang dir>)
src/lib/              utilitaires purs (money, cn, …)
src/components/ui/    primitives d'UI (Button, Card, …)
src/components/       composants métier (+ infra transverse : LocaleSwitcher)
src/server/           logique serveur & accès aux données (aucun Prisma ailleurs)
src/i18n/             config next-intl (routing, request, navigation)
src/styles/           tokens.css (design provisoire)
messages/             catalogues de traduction par locale
reference/            LECTURE SEULE, hors build (prototype + audit)
```

## 8. Outillage

- `npm run check` = `typecheck` + `lint` (ESLint) + `lint:css` (stylelint) + `test` (Vitest, PGlite).
- `npm run test:pg` = rejoue les tests d'invariants DB contre un **Postgres réel** (voir §5 bis).
  Pré-requis : un Postgres joignable via `DATABASE_URL` (le serveur de dev suffit) + droit `CREATEDB`.
- TypeScript en mode **strict** (+ `noUncheckedIndexedAccess`).
- Aucun emoji dans l'UI produite ; icônes via `lucide-react`. Composants maison (pas de librairie UI).
