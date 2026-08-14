# Déploiement — Syndici sur Vercel + Postgres hébergé

Procédure pour mettre la démo en ligne à une URL accessible partout. Conçue pour être
**rejouable**. Aucun secret n'est versionné : tout vit dans les variables
d'environnement Vercel et dans un fichier `.env` local **non commité**.

Principe de séparation des rôles :

- **Toi** crées les comptes (Vercel, hébergeur Postgres), génères les secrets et
  colles les valeurs. L'assistant ne crée aucun compte et ne saisit aucun identifiant.
- **L'assistant** a préparé le code (garde-fous, seed de démo pilotée par
  l'environnement, `.gitignore` durci) et vérifie ensuite ce qui est vérifiable sans
  se connecter.

Repère : 🧑 = à faire par toi · 🤖 = déjà fait / vérifiable par l'assistant.

---

## Pré-requis (une fois)

- 🧑 Un compte **GitHub** avec le dépôt poussé (branche `main` ou `master`).
- 🧑 Un compte **Vercel** (connecté à ce dépôt GitHub).
- 🧑 Un compte chez un hébergeur **Postgres** managé. Recommandé : **Neon**
  (neon.tech, offre gratuite, SSL par défaut). Alternative : Vercel Postgres.
- `openssl` (déjà présent sur macOS) pour générer les secrets.

---

## Étapes, dans l'ordre

### 1. 🧑 Créer la base Postgres de production

1. Crée un projet Postgres chez Neon (ou Vercel Postgres).
2. Neon fournit **deux** chaînes de connexion — copie les deux (SSL, `?sslmode=require`) :
   - **poolée** (l'hôte contient `-pooler`) → pour l'application → variable `DATABASE_URL` ;
   - **directe** (l'hôte SANS `-pooler`) → pour les migrations → variable `DIRECT_URL`.

   Pourquoi : le pooler transactionnel (PgBouncer) casse `prisma migrate` ; l'app, elle,
   tourne mieux sur la poolée. Le schéma Prisma gère ce cas (`url` + `directUrl`).
   Garde ces valeurs de côté — **ne les colle nulle part dans le dépôt**.

### 2. 🧑 Générer les secrets

Dans un terminal, génère deux valeurs aléatoires et garde-les de côté :

```bash
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 24   # → mot de passe du compte de démonstration
```

Le mot de passe de démo doit être **long et aléatoire** — jamais celui de
développement (`dev-syndic-2026`).

### 3. 🧑 Appliquer les migrations + charger la démo (depuis ta machine)

Depuis le dossier du projet. Remplace `<POOLED>` par la chaîne poolée, `<DIRECT>` par
la directe (étape 1), `<DEMO_PWD>` par le mot de passe de l'étape 2. Ces valeurs ne sont
passées qu'en ligne de commande, jamais écrites dans un fichier versionné :

```bash
# 3a. Créer le schéma (tables, index, contraintes) — via la connexion DIRECTE
DIRECT_URL="<DIRECT>" DATABASE_URL="<POOLED>" npx prisma migrate deploy

# 3b. Charger la démo (Al Firdaous + lots + propriétaires MRE + locataires +
#     impayés variés + paiements) ET créer le compte de démonstration
DATABASE_URL="<POOLED>" DIRECT_URL="<DIRECT>" \
  DEMO_SYNDIC_EMAIL="demo@syndici.ma" \
  DEMO_SYNDIC_PASSWORD="<DEMO_PWD>" \
  npm run db:seed
```

> Le seed n'affiche jamais le mot de passe. Il ne crée le compte de démo que si
> `DEMO_SYNDIC_PASSWORD` est fourni (≥ 12 caractères). Sans cette variable (cas du
> développement local), aucun compte de démo n'est créé.
>
> ⚠️ Le seed **réinitialise** les données de la base ciblée (démo repartant propre).
> Vérifie deux fois que les chaînes pointent bien sur la base de démo, pas une autre.

### 4. 🧑 Configurer les variables d'environnement Vercel

Dans Vercel → ton projet → **Settings → Environment Variables**, ajoute (scope
**Production**) :

| Nom            | Valeur                                        |
| -------------- | --------------------------------------------- |
| `DATABASE_URL` | la chaîne **poolée** (étape 1)                |
| `DIRECT_URL`   | la chaîne **directe** (étape 1)               |
| `AUTH_SECRET`  | la valeur `openssl rand -base64 32` (étape 2) |

`DEMO_SYNDIC_*` n'a **pas** besoin d'être dans Vercel (le compte est déjà créé à
l'étape 3). Ne mets jamais ces valeurs dans le dépôt.

### 5. 🧑 Déployer

1. Dans Vercel, importe le dépôt (Framework: **Next.js**, détecté automatiquement).
2. Lance le déploiement. Le script `build` = `prisma generate && next build` (le client
   Prisma est donc régénéré à CHAQUE build, même si Vercel met `node_modules` en cache).
   Aucune migration n'est jouée au build : elles l'ont été à l'étape 3.
3. Récupère l'URL de production (`https://<projet>.vercel.app`).

### 6. 🤖 Vérification (par l'assistant, sans se connecter) + 🧑 (connexion)

Donne l'URL à l'assistant. Il vérifiera **sans saisir d'identifiant** :

- la page de connexion se charge (`/fr/sign-in`) ;
- la bascule **arabe** (`/ar/sign-in`) inverse bien la mise en page (RTL) ;
- aucune erreur serveur, la base répond.

La connexion elle-même (compte de démo → tableau des lots avec les vraies données)
est à faire **par toi** : l'assistant ne saisit aucun mot de passe. Checklist :

1. Ouvre `https://<projet>.vercel.app/fr/sign-in`.
2. Connecte-toi avec `demo@syndici.ma` et le mot de passe de l'étape 2.
3. Ouvre **Résidences** → sélectionne **Résidence Al Firdaous**.
4. Vérifie le **tableau des lots** : ~25 lots, propriétaires à l'étranger, locataires,
   impayés variés (soldé / partiel / en retard).
5. Bascule en **arabe** (sélecteur d'en-tête) : la mise en page s'inverse (RTL).

---

## Garde-fous vérifiés

- **Aucun utilitaire de dev exposé** : `npm run dev:account` refuse de s'exécuter si
  `NODE_ENV === 'production'` (voir `scripts/dev-account.ts`). L'application n'expose
  aucune route de création de compte : le seul chemin est l'invitation (A6).
- **Identifiants jamais versionnés** : `.gitignore` ignore tout `.env*` (seul
  `.env.example`, sans valeurs réelles, est suivi).
- **Secrets aléatoires** : `AUTH_SECRET` et le mot de passe de démo sont générés par
  `openssl`, propres à la production.
- **Build indépendant de la machine locale** (vérifié) : le client Prisma est régénéré
  au build ; le build ne se connecte à AUCUNE base (testé avec une URL injoignable) ;
  aucun chemin absolu, aucun binaire natif (bcryptjs pur JS), `binaryTargets` non figé
  donc le moteur Prisma est généré pour la plateforme de build (Linux/Vercel).
- **Historique Git sans secret** (vérifié sur tous les commits) : aucun fichier `.env`
  réel, aucune chaîne de connexion réelle, aucun token.

## Pièges rencontrés (à ne pas revivre)

Deux causes réelles d'échec, vécues au premier déploiement — vérifiées et contournées :

1. **L'intégration Neon ne crée PAS `DATABASE_URL`.** Elle ajoute `POSTGRES_URL`
   (poolée), `POSTGRES_URL_NON_POOLING` / `DATABASE_URL_UNPOOLED` (directe), `PGHOST`,
   etc. Or le schéma Prisma lit `env("DATABASE_URL")` et `env("DIRECT_URL")` :
   **sans `DATABASE_URL`, l'application ne démarre pas** (aucune erreur au build, qui
   ne se connecte pas — l'échec est au runtime). ➜ Crée explicitement `DATABASE_URL`
   (poolée) et `DIRECT_URL` (directe) dans Vercel. Note : ces variables Neon sont
   marquées _Sensitive_ → `vercel env pull` les renvoie **vides**, on ne peut pas
   recopier leur valeur en ligne de commande ; prends les chaînes dans le dashboard Neon.

2. **`vercel env add NAME env` ignore l'entrée en pipe** (CLI v54) : `echo … | vercel
env add …` crée la variable avec une valeur **vide**, sans erreur visible. ➜ Utilise
   **`vercel env add NAME env --value "<valeur>" --yes`**, puis **vérifie** derrière
   (`vercel env ls`, et un redéploiement qui se connecte réellement à la base). Pour
   _Preview_, la CLI exige en plus une branche git — inutile ici, la démo tourne en
   Production.

3. **`AUTH_SECRET` peut être « présent » mais vide/inactif.** Symptôme : la page se
   charge, la base répond, mais **la connexion renvoie 500** et `/api/auth/session`
   affiche « There was a problem with the server configuration » (erreur `MissingSecret`
   d'Auth.js ; le CSRF est aussi tronqué). Comme `vercel env pull` ne renvoie pas les
   valeurs, **ne te fie pas à la simple présence** de la variable : vérifie par un **vrai
   test de connexion** (HTTP ou navigateur). Correctif : reposer la valeur et redéployer —
   `vercel env add AUTH_SECRET production --value "$(openssl rand -base64 32)" --yes`.

4. **Un reseed sans `DEMO_SYNDIC_PASSWORD` ORPHELINE le compte de démo.** Le seed vide
   toutes les personnes, puis ne recrée le compte de démo QUE si ce mot de passe est
   fourni. Sans lui, le bloc démo est sauté : l'`User` d'authentification survit mais sa
   `Person` métier n'est jamais recréée. Symptôme : la connexion réussit, mais l'app
   n'affiche qu'« Tableau de bord » sur un écran vide — le jeton porte un `personId` qui
   n'existe plus. **C'est arrivé plusieurs fois.** ➜ Toujours reseeder **avec**
   `DEMO_SYNDIC_PASSWORD` (voir ci-dessous). Depuis le correctif « session » (DECISIONS.md
   D33), une session ainsi périmée est renvoyée **explicitement** vers la connexion (plus
   de coquille vide) ; et l'`id stable` de la Person de démo fait que les reseeds
   **suivants** ne cassent plus la session.

## Rejouer / réinitialiser la démo

Pour repartir d'une démo propre : relancer l'étape **3b**, **impérativement avec
`DEMO_SYNDIC_EMAIL` ET `DEMO_SYNDIC_PASSWORD`** (sinon compte de démo orphelin — piège 4
ci-dessus). Pour éviter que le `.env` local n'écrase les variables passées en ligne de
commande (le CLI Prisma charge `.env`), utilise `npx tsx` directement :

```bash
DATABASE_URL="<POOLED>" DIRECT_URL="<DIRECT>" \
  DEMO_SYNDIC_EMAIL="demo@syndici.ma" \
  DEMO_SYNDIC_PASSWORD="<DEMO_PWD>" \
  npx tsx prisma/seed.ts
```

La `Person` du compte de démo porte un **id STABLE** (`prisma/seed.ts` → `DEMO_PERSON_ID` ;
en dev, `scripts/dev-account.ts` → `DEV_PERSON_ID`). Comme le rôle et la résidence sont
recalculés à chaque requête à partir du `personId`, un id stable suffit à faire **survivre
la session au reseed** — à condition que le mot de passe soit fourni pour que la Person
soit bien recréée. En local, relancer `npm run dev:account` après chaque `npm run db:seed`.

**Réparer un compte de démo déjà orphelin** (reseed passé sans le mot de passe), sans
tout recharger : recréer uniquement la `Person` de démo à l'**id stable**, son adhésion
`OWNER_ADMIN` `ACTIVE` dans l'organisation qui détient le mandat actif, et le lien
`authUserId` vers l'`User` existant (dont le `passwordHash` a survécu). Vérifier ensuite
par un test HTTP du flux d'auth (`/api/auth/csrf` → POST `/api/auth/callback/password` →
`/api/auth/session` doit renvoyer le `personId` stable).
