# Journal des décisions d'architecture — Syndici

Format : chaque entrée = date, décision, justification. Ordre chronologique.

---

## 2026-08-10 — Étape 1 : fondations

### D1. Réécriture complète, `reference/` en lecture seule

- **Décision** : nouvelle application ; le prototype (`reference/index-demo.html`, `index-connecte.html`)
  et l'audit (`reference/audit/`) sont des documents de référence, jamais du code. Rien n'est porté ni
  importé depuis `reference/`.
- **Justification** : audit `reference/audit/07-verdict.md` — logique métier 100 % côté client,
  sécurité absente par conception, fiabilité comptable inexistante. Base à réécrire, pas à récupérer.
- **Garde-fous** : `tsconfig` exclut `reference/` ; ESLint l'ignore et interdit les imports
  (`no-restricted-imports` sur `**/reference/**`) ; absent des globs Tailwind ; ignoré par
  Prettier/stylelint.

### D2. Stack

- **Décision** : Next.js 15 (App Router) + TypeScript **strict**, PostgreSQL + Prisma (étape ultérieure),
  Tailwind CSS 3.4, ESLint 9 (flat config), Prettier, Vitest, stylelint. Déploiement Vercel.
- **Justification** : stack imposée. Tailwind v3.4 (plutôt que v4) retenu pour un `tailwind.config.ts`
  explicite et un support mûr des utilitaires **logiques** (`ps-`, `pe-`, `ms-`, `me-`, `start-`,
  `border-s`, `rounded-s`), essentiels pour le RTL.

### D3. i18n avec next-intl, `fr` défaut + `ar`, extensible

- **Décision** : `next-intl` v4, routing par segment `[locale]`, `localePrefix: 'always'` (URLs `/fr`,
  `/ar`). Source de vérité des locales dans `src/i18n/routing.ts`. `en, nl, es, de` déclarés comme
  `plannedLocales` pour extension sans refonte.
- **Justification** : besoin MRE multilingue ; l'audit (point 13) a montré des traductions incohérentes
  faute de structure. Ici : catalogues séparés `messages/<locale>.json`, **zéro texte en dur** dès le
  premier composant, fallback géré par next-intl.

### D4. RTL par propriétés logiques, imposé par le lint

- **Décision** : `dir` posé sur `<html>` selon la locale (`getDirection`) ; **uniquement** des
  propriétés/utilitaires logiques ; règle de lint locale `logical-css/no-physical-properties` en
  **ERREUR** (classes Tailwind, `cn()/clsx()`, styles inline) + stylelint pour les `.css`.
- **Justification** : échec explicite du prototype (audit point 12) — il basculait `body.style.direction`
  sans inverser la mise en page. Ici l'inversion est structurelle et **non régressable** (le lint casse
  le build si on écrit `pl-`, `ml-`, `left-`, `text-left`, `border-l`, `rounded-l`, `padding-left`…).

### D5. Argent en entiers de centimes + helper centralisé

- **Décision** : tout montant = entier de centimes ; formatage exclusivement via `src/lib/money.ts`
  (`formatMoney`, devise `MAD`, locale-aware) ; `formatMoney` **lève** sur un non-entier. Tests dans
  `money.test.ts`.
- **Justification** : audit — le prototype affichait des montants en dur et manipulait des nombres
  fragiles ; la fiabilité financière est le cœur de la promesse. Les centimes entiers évitent les erreurs
  de flottant ; le point d'entrée unique garantit la cohérence d'affichage fr/ar.

### D6. Logique & accès aux données côté serveur (`src/server/`)

- **Décision** : aucun appel Prisma dans un composant ; toute la logique métier et l'accès aux données
  passent par `src/server/` (dossier réservé dès maintenant).
- **Justification** : correctif structurel de l'audit (`reference/audit/03-architecture.md` §4) — la
  logique côté client est falsifiable et non sécurisable. Le modèle de données viendra à une étape
  dédiée.

### D7. Design PROVISOIRE — tokens extraits, non définitifs

- **Décision** : `src/styles/tokens.css` reprend **verbatim** les variables du prototype
  (`reference/index-demo.html`, `:root`) et les 2 familles typographiques (Plus Jakarta Sans via
  `next/font`, DM Serif Display). Tailwind référence ces tokens (pas de duplication).
- **Précision honnête** : le prototype définit **22** propriétés personnalisées (le brief en évoquait 23),
  auxquelles s'ajoutent **2** familles typographiques ; elles sont reprises telles quelles, avec le nom
  d'origine `--label` (= « label-1 »).
- **Justification** : le design **sera retravaillé en fin de projet**. On ne vise aucune fidélité
  visuelle ; ces tokens sont une base de travail temporaire pour ne pas coder « à blanc ».
- **À revoir plus tard** : police arabe dédiée (Plus Jakarta Sans ne couvre pas l'arabe → repli
  system-ui pour l'instant) ; palette et échelles à refondre avec le design final.

### D8. ESLint 9 flat config + règle locale

- **Décision** : `eslint.config.mjs` (flat), `typescript-eslint`, plugin Next, React/React-hooks, et le
  plugin **local** `eslint-rules/logical-css.js`.
- **Justification** : la règle logique doit être un plugin local (matching regex sur les classes/les
  styles inline), impossible à exprimer avec `no-restricted-syntax` seul. Flat config = standard actuel
  et intégration propre d'une règle maison.

## 2026-08-10 — Étape 2 : extraction des ressources (textes, règles), sans composant ni modèle de données

### D9. Police arabe : Noto Sans Arabic via next/font, pilotée par la locale

- **Décision** : chargement de `Noto_Sans_Arabic` (`next/font/google`, sous-ensemble `arabic`) exposé en
  variable `--font-arabic-src`. `tokens.css` fait précéder les stacks par cette police pour la locale
  arabe : `:root[lang='ar'] { --font-sans/--font-serif: var(--font-arabic-src), <latin>, … }`. Les
  familles latines restent en repli pour les runs latins (chiffres, « MAD », noms propres).
- **Justification** : ce n'est pas arbitraire — le prototype spécifiait déjà « Noto Sans Arabic » dans sa
  fonction de bascule de langue (`_setLangFull`, D:1970). Plus Jakarta Sans / DM Serif Display ne
  couvrent pas l'arabe. Rendu vérifié en `/ar`.

### D10. Extraction des traductions → catalogues par domaine, fusion sans écrasement

- **Décision** : l'objet `translations` du prototype (fr, ar uniquement) est extrait vers
  `messages/fr.json` / `messages/ar.json`, **réorganisé par domaine** (namespaces informés par
  `audit/02-inventaire-fonctionnel.md` : landing, auth, sidebar, dashboard, residents, payments,
  expenses, news, signalements, messagerie, votes, documents, receipts, contracts, report, subscription,
  finance, history, transparency, vocab, buttons, status, account, residentHome). Fusion **sans écraser**
  les clés existantes (common/nav/home/locale de l'étape 1 préservées). Feuilles en camelCase conservant
  la clé prototype d'origine (traçabilité, zéro collision).
- **Emojis retirés des valeurs** : les emojis décoratifs (icônes) sont supprimés des chaînes extraites —
  ce sont de l'apparence, pas du contenu, et la règle « aucun emoji dans l'UI produite » (CONVENTIONS §8)
  s'applique. Les icônes seront des composants Lucide.
- **Décompte honnête** : le « ~577 fr / ~403 ar » du brief = **occurrences brutes** (l'objet `fr` du
  prototype est gonflé de doublons issus d'un copier-coller de/nl/es/en — anomalie M6). Clés **uniques
  effectives** : **fr 401 / ar 398**. Écart réel : **3 clés** (`app_nationalite`, `app_telephone`,
  `app_tous`), listées dans `reference/TRADUCTIONS-MANQUANTES.md`. Le catalogue ar est par ailleurs
  complet (seule valeur identique au fr : `locale.fr = "Français"`, intentionnel).
- **Méthode** : extraction par script jetable (scratchpad) qui **lit** `reference/` et **écrit**
  `messages/` — aucun import depuis `reference/` dans l'app (règle D1 respectée).

### D11. Vocabulaire adaptatif = contenu (catalogues), pas de code

- **Décision** : la bascule appartement/villa et immeuble/lotissement vit dans `messages/*.json` sous la
  clé **`vocabulaire`** (`concept → { immeuble | villa (| mixte) }`). Le futur code lira
  `vocabulaire.<concept>[type]` ; aucun terme d'habitation n'est codé en dur en TypeScript.
- **Justification** : consigne explicite — c'est du contenu, pas de la logique. En mode `mixte`, le mot
  suit le type propre de chaque unité (cf `vocabResident`, SPEC §7.3).

### D12. `reference/SPEC.md` = source de vérité fonctionnelle

- **Décision** : `SPEC.md` décrit le comportement **voulu** (pas l'observé), transcrit littéralement les
  7 règles métier demandées (relances + anti-harcèlement, échéances contrats, immeuble/villa/mixte,
  invitation par code, visibilité documents, compteur agrégé résident, reçus), et sépare l'intention des
  bugs (§8 « Anomalies à ne pas reproduire », renvois `audit/05-anomalies.md`).
- **Manques structurels** : §9 identifie, écran par écran, les points d'impact de la distinction
  propriétaire/locataire (absente du prototype) et des tantièmes — **sans concevoir la solution**
  (étape suivante).

## 2026-08-10 — Étape 3 : modèle de données (Prisma + PostgreSQL), sans UI ni auth

> Chaque décision imposée par le brief est appliquée. Les points où je la questionne
> et les zones où SPEC.md est muet/ambigu (et où j'ai tranché) figurent en fin de section.

### D13. Le LOT est le pivot ; rattachements historisés

- **Décision** : `Lot` est l'entité durable ; les personnes s'y rattachent via `LotAttachment`
  (historisé : `startDate`, `endDate` nullable, `role`). `ownerAt`/`occupantAt` (src/server/attachments)
  répondent à « qui possédait/occupait le lot X à la date D ».
- **Justification** : arbitrage imposé (#1) ; corrige l'inversion du prototype (résident central,
  n° d'appartement en attribut).

### D14. Propriétaire ≠ Locataire ; redevable délégable

- **Décision** : `AttachmentRole { OWNER, TENANT }`. Le redevable des charges = `LotAttachment.isChargePayer`
  (par défaut le propriétaire ; délégable au locataire). Index partiels (migration) : **un** OWNER actif,
  **un** TENANT actif, **un** payeur actif par lot.
- **Justification** : arbitrage imposé (#2) ; manque le plus grave du prototype (rôle unique).
- **Cas limite (choix)** : lot vacant → aucun rattachement actif → `chargePayerAt` peut être `undefined` ;
  l'appel de charges vise quand même le lot (l'UI devra afficher « aucun redevable actuel »).

### D15. Mandat Organisation ↔ Résidence (pas de `user_id`)

- **Décision** : `Organization` gère des `Residence` via des `Mandate` datés à statut. Un seul mandat
  ACTIF par résidence (index partiel), historique conservé. Les personnes sont liées à l'organisation
  via `Membership` (rôle).
- **Justification** : arbitrage imposé (#3) ; débloque cabinet multi-employés, changement de syndic,
  historique de gestion — impossibles avec `residences.user_id`.

### D16. Isolation multi-tenant côté serveur (barrière structurelle)

- **Décision** : `Residence` = unité d'isolation. `residenceId` **dénormalisé (non nul)** sur tous les
  modèles scopés (`TENANT_MODELS`). Le client Prisma brut n'est **pas exporté** ; le seul accès aux
  données tenant est `forResidence(residenceId)` (extension Prisma qui injecte `residenceId` sur chaque
  requête et **refuse** toute autre résidence — `TenantScopeError`). `enforceTenantScope` est pur et
  testé ; un test **méta** vérifie que `TENANT_MODELS` couvre exactement les modèles portant `residenceId`.
- **Multi-résidences** : jamais de requête globale. `resolveResidencesForOrganization/Staff/Owner`
  (seuls points de lecture transverses, restreints à `select residenceId`) donnent l'ensemble autorisé,
  puis on interroge chaque résidence via `forResidence`. Gère le MRE multi-lots et l'employé de cabinet
  sans exception.
- **Justification** : arbitrage imposé (#, isolation) ; le prototype confiait tout à la RLS Supabase
  (échec). Choix « extension + dénormalisation » plutôt que RLS Postgres : la barrière est dans le code
  applicatif (testable, portable, indépendante du fournisseur), et le `residenceId` local évite des
  jointures de contrôle sur chaque requête.
- **Limite assumée (signalée)** : (a) le garde couvre les opérations de 1er niveau — les écritures
  imbriquées doivent partir d'un modèle déjà scopé ; (b) `Person`/`Organization`/`Membership`/`Mandate`
  ne sont **pas** scopés résidence (identités durables, transverses) : l'accès à une `Person` (PII) doit
  être contrôlé à la couche autorisation (ne charger que les personnes atteignables via un
  `LotAttachment`/`Membership` déjà scopé), pas par le garde tenant.

### D17. Lot → Résidence obligatoire

- **Décision** : `Lot.residenceId` **non nullable** (FK). Un lot orphelin est impossible.
- **Justification** : arbitrage imposé (#4) ; rend l'unité d'isolation toujours déterminable.

### D18. Type de résidence structurel ; catégories de dépenses = données

- **Décision** : `Residence.type` (IMMEUBLE/VILLA/MIXTE) et `Lot.type` (APPARTEMENT/VILLA). En mixte, une
  résidence porte des lots des deux types. Les catégories de dépenses sont des **données**
  (`ExpenseCategory`, modifiables par résidence), pas un enum ; les deux jeux du prototype (8 immeuble /
  10 villa, union = 15) sont créés au seed. Le **vocabulaire** reste dans les catalogues i18n (non remis
  dans le schéma).
- **Justification** : arbitrage imposé (#5).

### D19. Règle de relance = entité versionnée + trace

- **Décision** : `ReminderRule` configurable et versionnée par résidence (défauts = valeurs exactes du
  prototype : seuil 3 j, anti-harcèlement 4 j, statuts PARTIAL+LATE, seuil de frais 10 j). `detectReminders`
  (src/server/reminders) transcrit fidèlement le moteur, tri retard décroissant. Chaque envoi est tracé
  par `Reminder` (destinataire, date, règle, canal, appel concerné).
- **Justification** : arbitrage imposé (#6).

### D20. Argent, statut dérivé, immuabilité, numérotation, audit

- **Décision** : montants en `Int` centimes (checks SQL de non-négativité / non-nullité). Le **statut**
  d'un appel de charges est **dérivé** (`deriveChargeStatus`), jamais stocké. Les `Payment` sont
  **immuables** (annulation = écriture inverse `reversesPaymentId`, montant négatif) ; pas de suppression
  physique sur les entités financières (`voidedAt`). Numérotation reçus/justificatifs = **séquence en
  base** continue par (résidence, exercice, série) via `NumberSequence` (upsert atomique, remplace le
  compteur mémoire — anomalie C9). `AuditLog` (acteur/action/entité/avant/après/horodatage).
- **Justification** : arbitrage imposé (#7).
- **Limite assumée (signalée)** : la **continuité sans trou** suppose que l'allocation du numéro et la
  création du reçu partagent la **même transaction** (rollback = pas d'incrément visible). Le service est
  conçu pour ça ; la base ne peut pas forcer l'appelant à englober les deux dans une transaction.

### D21. Le règlement est un rapprochement (sans présumer le PSP)

- **Décision** : `SettlementAccount` (prestataire, identifiant marchand, statut) rattaché à
  l'organisation **ou** à la résidence (check XOR). `Payment` porte une `reference` externe ; `ChargeCall`
  une `externalRef`. `PaymentAllocation` = **rapprochement** (part d'un règlement → appel de charges),
  identique pour espèces/carte/virement. Le statut découle de la somme des allocations.
- **Justification** : arbitrage imposé (#8) ; accueille le paiement en ligne sans présumer le prestataire
  ni le montage juridique (non arbitrés).

### D22. Couverture des entités + fichiers en référence

- **Décision** : documents avec portée (`DocumentScope` PRIVE/PARTAGE/INTERNE, `origin`), contrats
  fournisseurs (échéance dérivée), incidents + fil (`IncidentUpdate`), actualités typées + `audience`
  (ALL/OWNERS/TENANTS, prépare la diffusion différenciée SPEC §9), votes avec **un bulletin par LOT**
  (`@@unique(voteId, lotId)`) et `Ballot.weight` = quote-part (prévu, non utilisé en v1), reçus,
  codes d'invitation (**hash** stocké, usage unique, expirable, essais limités — corrige C1/C4/C5),
  messagerie persistée. **Fichiers** : `FileAsset` = référence de stockage objet (bucket + clé), jamais
  de base64 (corrige M2).

### D23. Outillage BD : migration hors-ligne, PGlite en test, Postgres local pour le seed

- **Décision** : migration initiale générée puis complétée à la main (index partiels + checks). Tests
  d'invariants DB **auto-contenus** via **PGlite** (Postgres en process) → `npm run test` ne dépend
  d'aucun serveur externe. Le seed est exécuté contre un Postgres local (binaires Homebrew) pour prouver
  qu'il tourne.
- **Justification** : reproductibilité du gate sans dépendance externe, tout en testant de vraies
  sémantiques Postgres (index partiels, checks, séquence).

### D24. Prisma 6 (et non 7)

- **Décision** : `prisma@^6` / `@prisma/client@^6` (moteur embarqué, générateur `prisma-client-js`).
- **Justification** : Prisma 7 impose des adaptateurs de driver et un nouveau générateur par défaut —
  surface de risque inutile pour cette étape. Prisma 6 : `migrate diff` hors-ligne, seed et génération
  simples. (Question ouverte : migrer vers 7 plus tard.)

## Étape 4 — Authentification, autorisations, invitation

### D25. Statut de charge sur deux axes indépendants (règlement × temporalité)

- **Décision** : remplacer l'énum unique `ChargeStatus` par deux énums dérivées et jamais stockées :
  `SettlementState` (`SETTLED`/`PARTIAL`/`UNSETTLED`) et `TemporalState` (`UPCOMING`/`DUE`/`OVERDUE`).
  `src/server/finance/status.ts`. Cela lève la réserve « PARTIAL vs LATE » : une charge peut être les deux.
- **Comportement de relance conservé** : `ReminderRule.concernedSettlementStates = [PARTIAL, UNSETTLED]`
  (champ versionné) ⇒ les partiels sont relancés comme les impayés, exactement comme le prototype.
  SPEC.md mis à jour (§7.7bis, §7.1).

### D26. Numérotation infalsifiable : allocateur privé, API transactionnelle

- **Décision** : l'allocateur de séquence n'est plus exporté et n'accepte qu'un `Prisma.TransactionClient`.
  Seules API publiques : `createReceipt()` / `createExpense()` qui ouvrent la transaction (allocation +
  insertion atomiques). `src/server/finance/numbering.ts`.
- **Justification** : rend structurellement impossible d'allouer un numéro hors transaction. Lève la
  réserve (1) de l'Étape 3 : un `ROLLBACK` ne consomme plus de numéro (testé, `numbering.test.ts`).

### D27. FileAsset porte une RÉFÉRENCE, jamais de binaire/base64

- **Décision** : contrainte SQL `CHECK` sur `FileAsset.storageKey` interdisant un préfixe `data:` et
  bornant la longueur (≤ 1024). Le contenu vit dans un stockage objet ; la base ne stocke qu'une clé.

### D28. Protection de `Person` par une couche d'accès unique (pas par convention)

- **Décision** : `src/server/auth/person-access.ts` est le **seul** module de production autorisé à lire/
  écrire `Person`. Toute lecture exige un chemin d'accès valide depuis le contexte actif (rattachement de
  lot scopé, ou appartenance à l'organisation mandataire) ; un refus renvoie `null` (aucune fuite
  d'existence). Un **test méta** (`person-access.meta.test.ts`) échoue si un autre module référence la
  table `"Person"` ou l'accesseur `.person`. Lève la réserve (2) de l'Étape 3.
- **Conséquence** : un locataire n'obtient jamais l'identité du propriétaire de son lot (testé, §6.2).

### D29. Rôle applicatif dérivé par (personne, résidence), jamais stocké

- **Décision** : le rôle (`SYNDIC`/`GESTIONNAIRE`/`PROPRIETAIRE`/`LOCATAIRE`) est recalculé pour chaque
  couple (personId, residenceId) — `src/server/auth/context.ts`. Staff via Membership ACTIF + Mandate
  ACTIF **non expiré** (`endDate >= CURRENT_DATE`) ; résident via LotAttachment courant. Un mandat expiré
  retire l'accès sans rien supprimer (testé, §6.4). Le cas MRE (propriétaire ici, locataire ailleurs) en
  découle naturellement.
- **Matrice d'autorisation** centralisée et **pure** dans `src/server/auth/permissions.ts` (`can(role,
perm)`, deny par défaut) — aucun test de rôle codé en dur ailleurs.

### D30. Onboarding par invitation : liaison unique, irréversible, sans repli e-mail

- **Décision** : code aléatoire de 12 caractères (alphabet sans `0/O/1/I/L`, ~59 bits), **haché** en base
  (SHA-256), usage unique, expiration 30 j, essais bornés. Le rattachement compte↔Person se fait une
  seule fois via un `UPDATE … WHERE authUserId IS NULL` (impossible de re-lier). **Aucun repli e-mail** :
  c'est précisément la faille de reprise de compte du prototype (C1/C4/C5) qui est fermée.
  `src/server/auth/invitation.ts`, `onboarding.ts`. La vérification n'expose au plus qu'un e-mail **masqué**.
- **Anti-écrasement** : créer un compte par mot de passe n'écrase jamais un compte existant (`EmailTakenError`).

### D31. Auth.js v5, session JWT, providers isolés (OTP préparé)

- **Décision** : NextAuth v5 + adaptateur Prisma. Session **JWT** (imposé par le provider Credentials).
  Providers isolés dans `src/server/auth/providers/` (mot de passe bcrypt ≥ 10 car., lien magique à
  transport journalisé en dev). Le seam OTP SMS/WhatsApp est matérialisé (`providers/otp.ts`) : l'activer
  = ajouter une entrée au tableau, sans refactor. Le JWT porte l'identité métier (`personId`) et le
  contexte multi-résidences (résidences accessibles + résidence active, revalidée côté serveur).
- **Couche SQL partagée** (`src/server/db/sql.ts`) : les gardes de sécurité sont écrites une fois contre
  une interface `SqlExecutor`/`TxRunner` exécutée à l'identique en prod (Prisma) et en test (PGlite) —
  pas de divergence entre ce qui est testé et ce qui tourne.

### D32. Stockage d'objets : abstraction de driver + accès servi par l'application (C0)

- **Décision** : couche `StorageDriver` (`src/server/storage/`) ; le fournisseur n'est jamais en dur.
  Driver **local** en dev (sans réseau), **Vercel Blob** en prod, sélectionnés par l'environnement ;
  chaque fichier porte son driver en préfixe de `storageKey` (`"<driver>:<ref>"`). La sécurité vit
  AU-DESSUS du driver, identique quel que soit le backend : un fichier est toujours scopé à une
  résidence (clé `residences/<id>/…`, isolation testée), et les octets ne sont servis QUE par
  `/api/files/[id]` derrière trois gardes — signature HMAC expirante (`AUTH_SECRET`), session,
  appartenance à la résidence active. Types (images + PDF) et taille (≤ 10 Mo) validés.
- **Store PRIVÉ (résolu)** : le store `syndici-blob` est créé en **accès privé**. Le driver écrit en
  `access: 'private'` et relit via le `get()` **authentifié** du SDK (jeton), jamais par un `fetch`
  public. Une URL Blob qui fuirait n'est donc **pas** atteignable sans le jeton — ce qui **lève la
  réserve initiale** (ci-dessous) : plus d'exposition sans authentification, même en cas de fuite d'URL.
  Le contenu reste servi au navigateur uniquement par `/api/files/[id]` (signature + session + scope).
- **Réserve initiale (levée par le mode privé, conservée pour mémoire)** : historiquement Vercel Blob
  n'exposait que des URLs **publiques** permanentes (révocation = suppression). Le mode privé rend ce
  point caduc. Si un jour on stocke des **pièces d'identité ou documents bancaires**, on pourra tout de
  même préférer un stockage à URLs pré-signées à TTL court (S3/**R2**) — le driver abstrait rend ce
  changement local (un seul fichier), sans toucher au code métier.

### Zones où SPEC.md est muet/ambigu et où j'ai tranché

- **Statut `UPCOMING`** : SPEC n'énumère que paid/partial/late. J'ai ajouté `UPCOMING` (impayé **avant**
  échéance) pour ne pas qualifier « en retard » un appel non échu. À valider.
- **PARTIAL vs LATE** : un appel partiellement payé mais échu reste `PARTIAL` (comme le prototype, qui
  traite « partiel » comme un bucket distinct et relance à la fois partiels et retards). À confirmer.
- **Exercice comptable** : SPEC parle d'« exercice » sans le définir. Choix : **année civile** de la date
  d'émission. À valider (exercice décalé ?).
- **Quote-part** : SPEC demande de la prévoir sans l'utiliser. Choix : `Lot.quotePart` (Int, défaut 1),
  copié dans `Ballot.weight` à l'émission du bulletin ; **aucun décompte pondéré** en v1.
- **Abonnement/plan** : porté par `Residence.plan` (comme le paywall votes du prototype). Il pourrait
  logiquement appartenir à l'`Organization` (le cabinet s'abonne). Laissé sur la résidence, à réévaluer.
- **Charges par lot** : `Lot.monthlyChargeMinor` porte la charge courante ; `Residence.defaultCharge*`
  sert de valeur par défaut. SPEC ne tranche pas si la charge dérive des tantièmes — non fait en v1.

### Décisions imposées qui me paraissent discutables (appliquées quand même)

- **Aucune** ne me paraît erronée. Les deux réserves d'exécution signalées à l'Étape 3 sont **levées à
  l'Étape 4** : (1) la continuité « sans trou » des reçus est désormais garantie par l'API
  transactionnelle `createReceipt`/`createExpense` (D26, allocateur privé tx-only) ; (2) la PII de
  `Person`, sortie du garde tenant pour le MRE, est protégée par une couche d'accès unique vérifiée par
  test méta (D28).
