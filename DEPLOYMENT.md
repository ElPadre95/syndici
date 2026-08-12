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
2. Copie la **chaîne de connexion** (format `postgresql://…?sslmode=require`).
   Garde-la de côté pour les étapes 3 et 4 — **ne la colle nulle part dans le dépôt**.

### 2. 🧑 Générer les secrets

Dans un terminal, génère deux valeurs aléatoires et garde-les de côté :

```bash
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 24   # → mot de passe du compte de démonstration
```

Le mot de passe de démo doit être **long et aléatoire** — jamais celui de
développement (`dev-syndic-2026`).

### 3. 🧑 Appliquer les migrations + charger la démo (depuis ta machine)

Depuis le dossier du projet, en pointant `DATABASE_URL` sur la **base de prod**
(remplace `<PROD_URL>` par la chaîne de l'étape 1, `<DEMO_PWD>` par le mot de passe
de l'étape 2). Ces variables ne sont passées qu'en ligne de commande, jamais écrites
dans un fichier versionné :

```bash
# 3a. Créer le schéma (tables, index, contraintes) sur la base de prod
DATABASE_URL="<PROD_URL>" npx prisma migrate deploy

# 3b. Charger la démo (Al Firdaous + lots + propriétaires MRE + locataires +
#     impayés variés + paiements) ET créer le compte de démonstration
DATABASE_URL="<PROD_URL>" \
  DEMO_SYNDIC_EMAIL="demo@syndici.ma" \
  DEMO_SYNDIC_PASSWORD="<DEMO_PWD>" \
  npm run db:seed
```

> Le seed n'affiche jamais le mot de passe. Il ne crée le compte de démo que si
> `DEMO_SYNDIC_PASSWORD` est fourni (≥ 12 caractères). Sans cette variable (cas du
> développement local), aucun compte de démo n'est créé.
>
> ⚠️ Le seed **réinitialise** les données de la base ciblée (démo repartant propre).
> Vérifie deux fois que `<PROD_URL>` est bien la base de démo, pas une autre.

### 4. 🧑 Configurer les variables d'environnement Vercel

Dans Vercel → ton projet → **Settings → Environment Variables**, ajoute (scope
**Production**) :

| Nom            | Valeur                                        |
| -------------- | --------------------------------------------- |
| `DATABASE_URL` | la chaîne Postgres de prod (étape 1)          |
| `AUTH_SECRET`  | la valeur `openssl rand -base64 32` (étape 2) |

`DEMO_SYNDIC_*` n'a **pas** besoin d'être dans Vercel (le compte est déjà créé à
l'étape 3). Ne mets jamais ces valeurs dans le dépôt.

### 5. 🧑 Déployer

1. Dans Vercel, importe le dépôt (Framework: **Next.js**, détecté automatiquement).
2. Lance le déploiement. Le build exécute `prisma generate` (via `postinstall`) puis
   `next build`. Aucune migration n'est jouée au build : elles l'ont été à l'étape 3.
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

## Rejouer / réinitialiser la démo

Pour repartir d'une démo propre : relancer l'étape **3b** seule (le seed réinitialise
les données et recrée le compte de démo).
