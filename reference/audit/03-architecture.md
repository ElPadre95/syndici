# 03 — Architecture

## 1. Technologies et dépendances

### Réellement utilisées
| Dépendance | Où | Chargée | Appelée |
|---|---|---|---|
| Google Fonts (Plus Jakarta Sans, DM Serif Display) | CDN, D:9 / C:28 | oui | oui (CSS) |
| `@supabase/supabase-js@2` | CDN, C:8 | oui (connecté seul) | oui (`createClient` C:17, auth + `.from()`) |
| RestCountries API v3.1 | `fetch` runtime, D:3055 / C:3074 | à la demande | oui (autocomplétion nationalité), fallback si échec |
| wa.me (WhatsApp) | `window.open`, D:5745 / C:~ | — | oui (relances/partage code) |

Aucun framework (pas de React/Vue), aucun bundler, aucune librairie tierce hors Supabase.
**Tout est vanilla JS dans un fichier HTML unique.** Aucune dépendance npm, aucun build.

### Chargé mais non/peu utilisé
- Fonction `checkAuth` (C:6418) définie mais **jamais appelée** → pas de restauration de session.
- `pageTitles` (D:2432 / C:2448), `actusDepenses` (D:5067 / C:5101), `residentsData` (D:1294 / C:1338) : **définis, jamais lus** (code mort).
- `checkPasswordMatch`, `startMsgSimulation` (timer vers un no-op en connecté).

## 2. Gestion de l'état, rendu, navigation

- **État** : variables globales de module (`currentRole`, `currentPage`, `residentsDB`, `paiementsDB`, `depensesDB`, `signalements`, `conversations`, `votesDB`, `contratsDB`, `actualitesManuelles`, `documentsPartages`, `recusDB`, `relancesHistorique`, `syndicData`, `_residentData`, etc.). Pas de store, pas d'immutabilité.
- **Rendu** : chaîne de fonctions `htmlXxx()` qui retournent des **template strings** injectées via `innerHTML` dans `#pageContainer`. Rendu intégral de la page à chaque navigation (`navTo`, D:2447 / C:2463), reconstruit tout le DOM de la page.
- **Navigation** : `navTo(id)` empile `navHistory` (cap 20), bascule les onglets, appelle `renderGerantPage`/`renderResidentPage`. Pas de routeur/URL ; tout est en mémoire, un rechargement perd l'état de navigation. Bouton retour maison (`goBack`).
- **Sécurité XSS** : les `htmlXxx` interpolent des données utilisateur (nom, description, note, nom de fichier…) directement dans `innerHTML` **sans échappement**. En connecté, ces données viennent de la base (saisies par d'autres utilisateurs) → **risque XSS stocké** (voir 05).

## 3. Modèle de données

### Démo (structures en mémoire, codées en dur)
- `residentsDB` (D:2525) : **canonique**, 10 résidents `{id,apt,type,nom,email,tel,nationalite,langue,status,retard,montant,paye}`.
- `paiementsDB` (D:4966) : 5 paiements en dur.
- `depensesDB` (D:5231) : 5 dépenses.
- `contratsDB` (D:5076) : 4 contrats.
- `votesDB` (D:5211) : 2 votes.
- `signalements` (D:1229) 3, `mesSignalements` (D:1236) 2, `conversations` (D:1242), `documentsPartages` (D:4770), `recusDB` ([]), `syndicData` (D:1259), `relancesHistorique` ({}).
- **Structures parallèles divergentes** : `residentsData` (3, mort), la liste appartements en dur (8), `paiementsDB` (apt divergents). Voir 05 (point 14).

### Connecté (schéma Supabase reconstitué à partir des requêtes)
Preuve = colonnes lues/écrites dans le code (lignes citées).

| Table | Colonnes prouvées | Preuve |
|---|---|---|
| `residences` | id, nom, adresse, type, nb_unites, charges_montant, charges_villa, gerant_nom, gerant_email, plan, user_id | C:6013-6044, 6872-6882 |
| `residents` | id (uuid), residence_id, user_id, apt, type, nom, email, tel, nationalite, langue, status, retard, montant, paye, code_acces, compte_cree, auth_id | C:6079-6100, 6108-6123, 6535, 6594, 6615-6619, 6652-6658, 5533 |
| `paiements` | id, residence_id, user_id, nom, apt, montant, mode, date_str | C:6132-6146 |
| `depenses` | id, residence_id, user_id, cat, description, montant, date_str, photo, num_recu | C:6168-6183 |
| `documents` | id, residence_id, user_id, resident_id, nom, type, data, from_who, scope, date_str | C:6200-6221 |
| `recus` | id, residence_id, user_id, resident_id, num, nom, apt, montant, mode, mois, date_str | C:6245-6264 |
| `votes` | id, residence_id, user_id, titre, description, date_limite, options(json), voters(json), statut | C:6274-6293 |
| `signalements` | id, residence_id, user_id, apt, resident, cat, loc, description, urgence, status, photo, date_str, date_resolu | C:6312-6332 |
| `actualites` | id, residence_id, user_id, emoji, titre, message, pill_class, pill_txt, is_vote, vote_id, date_str | C:6351-6371 |
| `contrats` | id, residence_id, user_id, nom, fournisseur, emoji, montant, echeance, frequence | C:6381-6399 |
| `relances` | residence_id, user_id, resident_id, date_str (+ created_at) | C:5757-5759, 5767 |

- **Pas de table `messages`/`conversations`** : la messagerie reste 100 % en mémoire (perdue au rechargement).
- **Toutes les colonnes de date sont des chaînes** (`date_str`, formatées `toLocaleDateString('fr-FR')`), pas des `date`/`timestamptz` → tri chronologique fiable impossible, i18n de la date figée à la création.
- **Photos = base64** dans colonnes texte (`depenses.photo`, `documents.data`, `signalements.photo`) — point 11.
- Il n'existe **aucune notion de propriétaire vs locataire, ni de tantièmes/quote-part** dans le schéma.

## 4. Où vit la logique métier — conséquences sécurité

- **100 % de la logique est côté client** (calcul du solde, taux de collecte, détection des relances, génération des numéros de reçu, décision « paiement réussi », bilan). Le serveur (Supabase) n'est qu'un magasin de lignes.
- Conséquences :
  - Toute règle (montants, statut « payé », numérotation de reçu, quote-part future) est falsifiable par le client (console). Un résident peut modifier `residentsDB`/`_residentData` en mémoire.
  - La sécurité repose **entièrement sur les policies RLS Supabase**, **non visibles dans le code**. Les requêtes du client (SELECT `residents` par `code_acces` **avant auth**, C:6535/6594 ; `select('*')` sur toute la résidence C:6079) **ne fonctionnent que si des policies les autorisent**. Les points 1-6 du brief suggèrent que ces policies sont absentes ou trop permissives. **Non déterminable par lecture statique du client** — il faut inspecter le projet Supabase (dashboard → Authentication/Policies) ou exécuter les requêtes en anonyme pour trancher.
  - Aucune validation serveur : montants négatifs, doublons de reçu, codes en collision passeraient (voir 05).
- La clé exposée (`SUPABASE_KEY`, C:12) est la clé « publishable/anon » — normale à exposer, MAIS elle ne protège rien : seule la RLS protège.

## 5. Mode immeuble / villa / mixte

- Réglage : `syndicData.type` ∈ {immeuble, villa, mixte} (`setResidenceType`, D:3852 / C:~).
- Adaptations réelles :
  - **Vocabulaire** : `vocab(key)` (D:1279) — mais **ne teste que `type==='villa'`** ; le mode **mixte retombe sur « immeuble »**. `vocabResident(r,key)` (D:2539) gère le mixte par type du résident. `kpiUnitesLabel`/`countUnites` gèrent le mixte. → **Support incohérent selon la fonction.**
  - **Catégories de dépenses** : `depensesCategoriesImmeuble` vs `depensesCategoriesVilla` ; mixte = union (D:5054-5063 / C:5088-5097). Adaptation réelle et correcte.
  - **Charges** : `chargesMontant` (appt) vs `chargesVilla` ; le formulaire d'ajout pré-remplit selon le type (`selectNewType`).
- **Fragilité** : l'abstraction est un patchwork de conditions `type==='villa'`/`'mixte'` disséminées, pas une couche unifiée. Le libellé « Appartement » reste codé en dur à plusieurs endroits (ex. sheet ajouter-apt `new-apt-lbl`, profil « Appartement »). Solide sur les catégories, fragile sur le vocabulaire.

## 6. Multilingue et RTL

- 6 langues UI : fr, en, ar, es, de, nl (`translations`, D:1308 / C:1352). Fallback `t()` : `currentLang → fr → clé` (D:1935).
- **Qualité très inégale** (voir 04 pour le décompte) :
  - fr/en/ar/es/de : objets complets (avec le grand bloc de vocabulaire applicatif).
  - **nl : gravement incomplet** — l'objet `nl` (D:1525 / C:1569) **ne contient PAS** le bloc `s_messages/vote_/doc_/sig_/dep_/recu_/voc_/ctr_/bilan_/abo_/fin_/hist_/mois_`. Ce contenu néerlandais a été **collé par erreur dans l'objet `en`** (D:1467 / C:1511) où il est écrasé (mort). En mode nl, ces clés retombent en **français**.
  - Les gros « blob lines » (D:1363 fr) empilent des clés dupliquées de plusieurs langues (de/nl/es/en/fr) ; seule la dernière (fr) l'emporte. Copier-coller fragile, non maintenable.
- **RTL (arabe)** :
  - CSS `[dir="rtl"]` présent **uniquement** pour `.msg-popup`/`.msg-fab` (D:477/489/490).
  - **Démo** : `_setLangFull` pose `document.body.style.direction='rtl'` (D:1969) → le texte passe en RTL, mais l'attribut `dir` n'est **pas** posé (les règles `[dir="rtl"]` ne s'appliquent donc pas) et le layout (sidebar `left:0`, `margin-left`) reste LTR. **RTL partiel.**
  - **Connecté** : le code de `_setLangFull` est à confirmer, mais le CSS est identique. L'attribut `dir` n'est jamais posé sur `<html>`/`<body>` (aucun `setAttribute('dir'...)` trouvé). Le point 12 (« l'arabe s'affiche de gauche à droite ») est donc **partiellement fondé** : le layout global reste LTR ; en démo au moins le flux de texte est inversé via `direction`. À vérifier par exécution.
- `<html lang="fr">` reste figé (D:2 / C:2) ; jamais mis à jour selon la langue.

## 7. Jugement sur l'architecture (au regard du projet)

**En tant que prototype de démonstration : excellent.** Un seul fichier, aucun build, ouvrable partout,
UI soignée et crédible, couvre visuellement toute la promesse produit. Pour vendre/valider le concept
auprès de syndics et de MRE, c'est efficace.

**En tant que base d'application réelle : inadaptée, et ce structurellement.**
- Toute la logique métier (argent, statuts, reçus) est côté client donc **non fiable et falsifiable** ; pour un produit qui vend la *confiance* et la *transparence financière* à des propriétaires absents, c'est rédhibitoire.
- La sécurité dépend entièrement de RLS invisibles ; les requêtes anonymes sur `residents` (avant auth) montrent que le modèle de sécurité n'a pas été pensé côté données (points 1-6).
- Le rendu par `innerHTML` de template strings sans échappement est une **surface XSS** dès que les données sont multi-utilisateurs.
- Le modèle de données ignore le cœur métier réel (propriétaire vs locataire, quote-part) — voir 07.
- Le stockage des factures/documents en base64 en base ne passera pas l'échelle (point 11).

Cette architecture sert bien la *démonstration* du métier, mais pas son *exploitation*. Elle n'a pas
de couche métier isolable qu'on pourrait « durcir » : la logique est diffuse dans les fonctions de rendu.
