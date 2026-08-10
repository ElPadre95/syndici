# SPEC — Syndici

Spécification fonctionnelle destinée à piloter le développement. **Elle décrit le comportement VOULU**,
pas le comportement observé du prototype. Les écarts prototype↔intention sont signalés et regroupés en
§8 « Anomalies à ne pas reproduire ».

Sources : audit `reference/audit/02-inventaire-fonctionnel.md`, `04-cheminement.md`, `05-anomalies.md`,
`03-architecture.md`, et relecture directe de `reference/index-demo.html` / `index-connecte.html`
(numéros de ligne cités `D:`/`C:`). Le prototype est une référence, jamais du code à reprendre.

## 0. Principes transverses (s'appliquent à tout l'app)

- **Deux espaces / deux rôles** : Gérant (le syndic) et Résident. (Voir §9 : la distinction
  propriétaire/locataire n'existe pas dans le prototype et devra être introduite.)
- **Argent** : tout montant en **entiers de centimes**, formaté via `formatMoney` (MAD, locale-aware).
  Aucun montant en dur, aucun float. (`CONVENTIONS.md` §3.)
- **i18n** : tout texte via `messages/<locale>.json`. fr (défaut) + ar livrées ; en/nl/es/de planifiées.
- **RTL** : layout logique, `dir` sur `<html>`. Police arabe = Noto Sans Arabic.
- **Logique métier & autorisations côté serveur** (`src/server/`), jamais dans le rendu. Toute règle
  ci-dessous est à implémenter et vérifier **serveur**, pas cliente.
- **États obligatoires par écran** : normal · **vide** (aucune donnée) · **chargement** · **erreur**
  (échec serveur explicite, jamais un faux succès — cf §8).
- **Périmètre paiement en ligne** : NON tranché (Stripe indisponible au Maroc, agrément établissement de
  paiement). Le tunnel carte du prototype est décoratif : à **ne pas** reproduire tel quel (§8).

### Énumérations (états)

- **Statut de paiement d'une unité** : le prototype le décrivait comme un axe unique
  `paid` / `late` / `partial`, où `partial` et `late` s'excluaient. **Corrigé à l'Étape 4**
  (cf §7.7bis) : le statut est désormais **dérivé sur DEUX axes indépendants** — l'état de
  règlement `SETTLED` / `PARTIAL` / `UNSETTLED` (soldé / partiel / non réglé) et la
  temporalité `UPCOMING` / `DUE` / `OVERDUE` (à venir / dû / en retard). Une charge peut
  donc être à la fois `PARTIAL` **et** `OVERDUE`. Aucun statut n'est stocké.
- **Signalement — statut** : `nouveau` · `en-cours` · `resolu`.
- **Signalement — urgence** : `normale` · `importante` · `urgente`.
- **Vote — statut** : `ouvert` · `clos`.
- **Document — portée (`scope`)** : `prive` · `partage` · `interne` (cf §7.5).
- **Document — origine (`from`)** : `gerant` · `resident`.
- **Type de résidence** : `immeuble` · `villa` · `mixte` (cf §7.3).
- **Plan d'abonnement** : `starter` · `pro` · `entreprise` (les votes sont réservés à pro/entreprise).
- **Mode de paiement** : `especes` · `carte`.

---

## 1. Écrans communs (hors espaces)

### 1.1 Landing marketing
- **Blocs** : nav (liens Solution/Fonctionnalités/Tarifs + sélecteur langue + « Se connecter »), hero
  (accroche + 3 stats), problème (3 cartes), fonctionnalités (onglets Résidents/Gérants, 4+4 cartes),
  tarifs (3 offres), CTA e-mail, footer.
- **Données** : statique/marketing. **Intention** : les 3 offres tarifaires ne doivent PAS être en dur
  dans le composant (le prototype code 199/499/devis en dur) — elles proviennent d'une config.
- **États** : normal uniquement.

### 1.2 Sélection du rôle
- **Blocs** : deux cartes « Espace Gérant » / « Espace Résident ».
- **Action** : mène à l'écran d'authentification correspondant.

### 1.3 Authentification Gérant
- **Formulaire** : email, mot de passe.
- **Écrit/lit** : session d'auth serveur. Succès → espace gérant chargé pour **sa** résidence.
- **États** : normal · en cours (« Connexion… », bouton désactivé) · **erreur** (« Email ou mot de passe
  incorrect ») · vide (champs requis).

### 1.4 Authentification / Inscription Résident
- Deux onglets : **Connexion** (email + mot de passe) et **Inscription par code** (cf §7.4).
- **États** : normal · en cours · erreur (identifiants ; code invalide ; code déjà utilisé ; compte non
  lié à un résident) · vide.

---

## 2. Espace GÉRANT — écrans

Réf. inventaire `02-inventaire-fonctionnel.md` §B. Pour chaque écran : Blocs / Formulaires / Lit / Écrit / États.

### 2.1 Tableau de bord
- **Blocs** :
  1. Bandeau « relances nécessaires » (visible si le moteur §7.1 renvoie ≥ 1) → action « Tout relancer ».
  2. Carte trésorerie : `trésorerie = solde_reporté + encaissé − dépensesMois`. **Intention** : le
     solde reporté est une donnée de la résidence, pas un nombre magique (prototype : `24850` en dur
     puis `0`).
  3. KPI : nombre d'impayés, taux de collecte, nombre d'unités (libellé adaptatif §7.3), retard moyen.
  4. Collecte du mois (barre + encaissé/manquant), liste des impayés à relancer.
  5. Derniers paiements reçus.
  6. Contrats & échéances (tri et alertes §7.2), bouton « Générer le bilan annuel ».
- **Lit** : unités+statuts, paiements, dépenses, contrats, historique de relances.
- **Écrit** : rien directement (actions déléguées aux écrans/sheets).
- **États** : normal · **vide** (aucune unité → KPI à 0, listes « aucun ») · chargement · erreur.

### 2.2 Résidents (liste + fiche)
- **Blocs** : recherche ; 4 KPI cliquables (total / à jour / en retard / demandes en attente) ; liste.
- **Liste — par ligne** : avatar (initiales), nom, unité + téléphone, nationalité + langue, pastille de
  statut (à jour / retard N j), bouton « Fiche ».
- **Filtres** : `all` · `paid` · `late` · `demandes` (bascule vers les signalements en attente).
- **Recherche** : nom / unité / nationalité / langue (côté serveur à terme).
- **Fiche résident (sheet)** — Blocs : en-tête (nom, unité, statut) ; infos (email, téléphone,
  nationalité, langue) ; historique de paiements (réels) ; **documents partagés** ; **dossier interne**
  (§7.5) ; **code d'accès** (générer / envoyer, §7.4) ; boutons Modifier / Supprimer.
- **Formulaire d'édition** : nom, email, téléphone, nationalité (autocomplétion pays), langue, charges
  mensuelles.
- **Écrit** : création / mise à jour / suppression d'un résident ; upload de documents ; génération de code.
- **États** : normal · **vide** (« Aucun résident — Ajouter ») · résultat de recherche vide · erreur.

#### Formulaire « Nouveau résident »
Champs : prénom, nom, email, téléphone (WhatsApp), nationalité, langue préférée, **type de logement**
(appartement/villa — affiché **uniquement en mode mixte**, §7.3), numéro d'unité, charges mensuelles,
statut initial (à jour / en retard). Un **code d'accès** est généré (§7.4).
- **Validation (intention)** : prénom, nom, unité obligatoires ; email valide s'il est fourni ; montant
  entier positif.

### 2.3 Unités (appartements / villas)
- **Blocs** : 3 KPI (nombre d'unités / à jour / en retard) ; recherche ; filtres (tous / retard / payé) ;
  liste des unités (n°, occupant, statut, montant, action relance si en retard).
- **Intention** : liste **pilotée par les données** (le prototype démo affichait 8 lignes en dur —
  §8). Le libellé « appartement / villa » suit §7.3.
- **États** : normal · **vide** (« Aucune unité — Ajouter ») · erreur.

### 2.4 Paiements
- **Blocs** : bouton « Enregistrer un paiement » (espèces) ; 4 KPI (encaissé / manquant / taux /
  nombre d'unités) ; liste des impayés (relance + encaisser espèces) ; derniers paiements (mode espèces/carte).
- **Formulaire « Paiement espèces »** (sheet) : résident (select), montant (MAD), date, note.
  Logique §7.7.
- **Écrit** : paiement + statut de l'unité (§7.7) ; reçu si complet.
- **États** : normal · **vide** (aucun impayé → « Aucun impayé » ; aucun paiement → liste vide) · erreur.
- **Intention** : « manquant » = somme des restes dus de **toutes** les unités non soldées (le
  prototype exclut les partiels — §8/m5).

### 2.5 Messages
- **Blocs** : liste des conversations ; recherche d'un résident pour démarrer ; fil + saisie.
- **Intention** : la messagerie doit être **persistée** (table dédiée) — le prototype la garde en mémoire
  (perdue au rechargement) (§8). États : normal · **vide** (« Aucune conversation ») · erreur.

### 2.6 Dépenses / Budget
- **Blocs** : total (hero) ; répartition par catégorie (barres) ; liste des factures (photo, catégorie,
  date, montant, justificatif, suppression). Dossier par catégorie.
- **Formulaire « Nouvelle dépense »** : photo de facture, catégorie (liste selon §7.3), description,
  montant, date. Numéro de justificatif `DEP-<année>-<n>` (unicité §7.7).
- **Écrit** : dépense (+ pièce jointe). **Intention** : la pièce jointe va dans un **stockage d'objets**
  (Storage/S3), pas en base64 en base (§8/M2).
- **États** : normal · **vide** (« Aucune facture ») · erreur.

### 2.7 Actualités
- **Blocs** : bouton « Publier » ; liste des actualités publiées (type, titre, message, date, nb notifiés).
- **Formulaire** : type (Information / Travaux / Urgent / Réunion / Terminé), titre, message.
- **États** : normal · **vide** (« Aucune actualité ») · erreur.
- **Intention** : pas d'actualités « en dur » (le prototype en injecte 5 fixes — §8).

### 2.8 Signalements (+ archives)
- **Blocs** : 3 KPI (nouveaux / en cours / archivés) ; recherche ; liste **groupée par urgence**
  (urgente / importante / normale) ; page « Archives » (résolus) avec « Rouvrir ».
- **Actions par signalement** : « Prendre en charge » (`nouveau`→`en-cours`), « Marquer résolu »
  (→`resolu`, date de résolution), « Contacter » (message au résident).
- **Lit** : signalements de la résidence. **Écrit** : statut, date de résolution.
- **États** : normal · **vide** (« Tout est traité ») · recherche vide · erreur.
- **Intention** : un signalement créé côté résident **apparaît** côté gérant (le prototype démo les
  déconnecte — §8/M5).

### 2.9 Votes (réservé pro/entreprise)
- **Paywall** : si `plan === 'starter'`, écran verrouillé + invitation à passer pro. Sinon :
- **Blocs** : bouton « Nouveau vote » ; liste des scrutins (titre, description, options + résultats,
  date limite, nb votants, statut) ; « Clôturer ».
- **Formulaire** : titre, description, date limite. Options **Pour / Contre / Abstention** générées
  automatiquement.
- **À la clôture** : calcul de l'option gagnante + publication d'une actualité de résultat.
- **États** : verrouillé (starter) · normal · **vide** (« Aucun vote ») · erreur.

### 2.10 Réglages
- **Blocs** : type de résidence (immeuble/villa/mixte, §7.3) ; champs éditables (nom, adresse, nombre
  d'unités, charges appartement/villa selon le type, échéance) ; compte gérant (nom, email) ;
  abonnements (starter/pro/entreprise) ; automatisations (relances auto, frais de retard, notifications,
  rapport mensuel) ; déconnexion.
- **Écrit** : réglages de la résidence (persistés — les toggles d'automatisation ne le sont pas dans le
  prototype, §8/m6).

### 2.11 Bilan annuel (AG)
- **Blocs** : en-tête + 4 totaux (recettes / dépenses / solde / taux) ; recettes (charges appelées /
  encaissé / restant) ; dépenses par catégorie ; contrats en cours ; bouton imprimer/PDF.
- **Intention** : date du bilan = date réelle de génération (prototype : « 10 juin 2026 » en dur — §8).

---

## 3. Espace RÉSIDENT — écrans

### 3.1 Accueil
- **Blocs** : hero statut (à jour / partiel / retard) avec montant dû et bouton Payer ; 3 KPI (statut,
  charges/mois, reste à payer) ; **widget de transparence collective** (§7.6) ; derniers paiements ;
  actualités récentes.
- **États** : normal · selon statut ; erreur.

### 3.2 Paiements
- **Blocs** : hero (dû / reste) ; historique (mois courant + paiements réels).
- **Formulaire « Payer »** : voir §8 — le tunnel carte est décoratif ; l'intention dépend du PSP retenu.
- **États** : normal · **vide** (« Aucun paiement enregistré ») · erreur.

### 3.3 Budget (consultation des dépenses)
- **Blocs** : KPI (solde / total dépenses / taux) — **données réelles**, pas en dur (§8) ; dépenses par
  catégorie ; dernières factures (justificatif consultable).
- **Intention** : transparence des dépenses = argument central pour le MRE. Le résident consulte les
  factures de la résidence.

### 3.4 Signalements
- **Blocs** : bouton « Nouveau signalement » ; liste « Mes signalements » (catégorie, statut, urgence,
  localisation, description, date, photo).
- **Formulaire** : localisation, catégorie, description, photo, urgence.
- **Écrit** : signalement (visible du gérant §2.8). **États** : normal · **vide** · erreur.

### 3.5 Documents
- **Blocs** : boutons ajouter / photo ; documents partagés ; **mes documents** (privés + partagés) ;
  reçus de paiement. Choix à l'upload : **partager avec le syndic** ou **garder privé** (§7.5).
- **États** : normal · **vide** · erreur.

### 3.6 Actualités / 3.7 Votes / 3.8 Messages / 3.9 Profil
- Actualités : fil de la résidence (vide si aucune). Votes : voter (une fois) + résultats. Messages :
  fil avec le syndic. Profil : infos + statistiques (données réelles).

---

## 7. Règles métier (transcrites littéralement)

> Transcription **fidèle** du prototype (sans reformulation). Les défauts de ces transcriptions
> (date figée, compteur mémoire, etc.) sont l'**implémentation** du prototype, pas l'intention : voir §8.

### 7.1 Détection des relances nécessaires (+ anti-harcèlement)

`reference/index-demo.html` D:5656-5674 :

```js
let relancesHistorique = {};

function detecterRelancesNecessaires() {
  const aujourdhui = new Date();
  return residentsDB.filter(r => {
    if (r.status !== 'late' && r.status !== 'partial') return false;   // statuts concernés
    if ((r.retard || 0) < 3) return false;                            // seuil : retard >= 3 jours
    const hist = relancesHistorique[r.id];
    if (hist && hist.lastDate) {
      const joursDepuis = Math.floor((aujourdhui - new Date(hist.lastDate)) / (1000*60*60*24));
      if (joursDepuis < 4) return false;                              // anti-harcèlement : < 4 j -> exclu
    }
    return true;
  }).sort((a, b) => (b.retard || 0) - (a.retard || 0));               // tri : retard décroissant
}

function marquerRelance(residentId) {
  if (!relancesHistorique[residentId]) relancesHistorique[residentId] = { count: 0, lastDate: null };
  relancesHistorique[residentId].count++;
  relancesHistorique[residentId].lastDate = new Date().toISOString();
}
```

- **Statuts concernés** : `late` ou `partial`.
- **Seuil de retard** : `retard >= 3` jours.
- **Anti-harcèlement** : exclu si relancé il y a **moins de 4 jours** (`joursDepuis < 4`).
- **Ordre** : retard **décroissant**.
- **Frais de retard** : dans le message de relance, `frais = (retard >= 10)` (seuil 10 j) et le texte
  mentionne « 20 MAD ». **Aucun montant n'est réellement ajouté** aux charges (cf §8).
- **Intention** : historique de relances **persisté** (le prototype démo le garde en mémoire), horodatage
  serveur (`marquerRelance` à l'envoi effectif).

> **Transcription vers le modèle à deux axes (Étape 4).** Le prototype testait
> `status !== 'late' && status !== 'partial'`. Avec la séparation des axes (§7.7bis),
> le comportement est **conservé à l'identique** : la règle de relance porte le champ
> versionné `concernedSettlementStates = [PARTIAL, UNSETTLED]` (les partiels sont
> relancés comme les impayés), et la condition « en retard » vient de l'axe temporalité
> via `overdueThresholdDays` (≥ 3 j). Un partiel non encore échu n'est donc pas relancé,
> exactement comme le prototype (qui exigeait déjà un `retard >= 3`).
> Implémentation : `src/server/reminders/rule.ts` (`detectReminders`), testée dans
> `src/server/reminders/rule.test.ts`.

### 7.2 Échéances des contrats fournisseurs

`joursAvantEcheance` D:5085-5089 et seuils d'alerte D:3308-3313 :

```js
function joursAvantEcheance(dateStr) {
  const today = new Date('2026-06-10');   // ⚠ DATE FIGÉE — bug, cf §8/M1 ; l'intention = date réelle
  const ech = new Date(dateStr);
  return Math.ceil((ech - today) / (1000*60*60*24));
}
// Tri des contrats : joursAvantEcheance croissant.
// Seuils d'alerte :
//   jours  < 0   -> "Expiré"           (rouge)
//   jours <= 30  -> "<n> jours"        (orange)
//   sinon        -> "<n> jours"        (vert)
```

- **Intention** : `today` = **date réelle** du serveur (la date figée est un bug).

### 7.3 Immeuble / Villa / Mixte — vocabulaire ET catégories de dépenses

**Vocabulaire** (contenu → vit dans `messages/*.json` sous `vocabulaire`, cf §7.3bis). Mapping du
prototype (`vocab` D:1279-1291, `vocabResident` D:2539-2548) :

- `unite` : immeuble→Appartement / villa→Villa
- `unite_plur` : Appartements / Villas
- `unite_court` : Appt / Villa
- `ensemble` : Immeuble / Lotissement
- `ensemble_de` : de l'immeuble / du lotissement
- **Mode `mixte`** : le mot suit le **type propre de chaque unité** (`vocabResident` : villa→termes
  villa, sinon termes appartement). *(Le prototype `vocab()` global ignore `mixte` et retombe sur
  immeuble — incohérence §8/M8 ; l'intention est le comportement per-unité de `vocabResident`.)*
- `typeLabel` : Immeuble (appartements) / Lotissement (villas) / Mixte (appartements + villas).

**Catégories de dépenses** selon le type (`setResidenceType` D:3852-3862, listes D:5054-5061). Icônes
décoratives retirées (aucun emoji dans l'UI produite) ; libellés :

- **Immeuble (8)** : Nettoyage · Électricité · Eau commune · Maintenance · Ascenseur · Assurance ·
  Travaux · Autre.
- **Villa / lotissement (10)** : Piscine commune · Jardins / espaces verts · Gardiennage ·
  Éclairage public · Voirie / routes · Arrosage · Ramassage déchets · Maintenance · Assurance · Autre.
- **Mixte** : **union** des deux listes, sans doublons (Maintenance, Assurance, Autre communs).

### 7.3bis Vocabulaire adaptatif = contenu (pas de code)

Le vocabulaire adaptatif est extrait dans les catalogues sous la clé **`vocabulaire`** (structure
`concept → { immeuble | villa (| mixte pour typeLabel) }`), en fr et ar. Le code se contentera de lire
`vocabulaire.<concept>[type]` — aucun mot d'habitation en dur en TypeScript.

### 7.4 Invitation d'un résident par code d'accès (bout en bout)

1. **Génération (gérant)** — fiche résident. `genererCodePour` (`reference/index-connecte.html` C:5526-5537) :
   ```js
   r.codeAcces = r.apt.toUpperCase().replace(/\s/g,'') + Math.floor(1000 + Math.random() * 9000);
   // -> code = <numéro d'unité en majuscules> + 4 chiffres aléatoires
   ```
   *(⚠ code prévisible, non unique, sans limite — §8/C4 ; l'intention = code aléatoire non devinable,
   unique, révocable, à durée/essais limités.)*
2. **Partage** — `partagerCodeAcces` C:5511-5523 : message WhatsApp pré-rempli (`wa.me`) ou copie
   presse-papier si pas de téléphone.
3. **Saisie (résident)** — onglet « Inscription » : champ **code**. Au blur, `prefillEmailFromCode`
   pré-remplit l'email enregistré si valide. *(⚠ ce pré-remplissage lit `residents` en anonyme — §8/C1 ;
   l'intention = validation du code par une fonction serveur ne divulguant rien.)*
4. **Création du compte** — `inscrireResident` C:6572-6631, dans l'ordre :
   - valider champs (code, email, mot de passe ≥ 6, confirmation identique) ;
   - vérifier que le **code existe** (sinon « Code invalide ») ;
   - vérifier que le code **n'est pas déjà utilisé** (`compte_cree` faux, sinon « déjà utilisé ») ;
   - créer le compte d'auth (email + mot de passe) ;
   - se connecter ;
   - **lier** : `residents.update({ compte_cree: true, auth_id, email })` sur la fiche ;
   - entrer dans l'espace résident.
   *(⚠ le SELECT du code se fait en anonyme et la liaison par email est usurpable — §8/C1,C5 ;
   l'intention = vérification et liaison serveur, code à usage unique, pas de SELECT anonyme.)*

### 7.5 Visibilité des documents

`scope ∈ { prive | partage | interne }`, `from ∈ { gerant | resident }`
(D:4768-4775, `confirmDocChoice` D:4608-4618, rendu résident D:4504-4523, fiche gérant D:2739-2743) :

| scope | déposé par | **Résident voit** | **Gérant voit** |
|---|---|---|---|
| `prive` | résident | Oui (ses documents privés) | **Non** |
| `partage` | résident **ou** gérant | Oui | Oui |
| `interne` | gérant | **Non** | Oui (dossier interne, « visible par vous uniquement ») |

- À l'upload par le **résident** : choix explicite **Partager avec le syndic** (`partage`) ou **Garder
  privé** (`prive`).
- À l'upload par le **gérant** : choix **Partagé** (`partage`, visible du résident) ou **Interne**
  (`interne`, invisible du résident).
- **Intention** : ces règles de visibilité sont **imposées côté serveur** (autorisations), pas seulement
  filtrées à l'affichage.

### 7.6 Compteur agrégé côté résident (« N ont payé, M en attente »)

`htmlResidentAccueil` D:4250-4272 :

```js
const total   = residentsDB.length;
const payes   = residentsDB.filter(r => r.status === 'paid').length;
const impayes = total - payes;
const taux    = total > 0 ? Math.round(payes / total * 100) : 0;
```

- Affiche : `taux %`, « ✅ {payes} ont payé », « ⏳ {impayes} en attente » (ou « Tout le monde a payé »).
- Messages contextuels : si des impayés **et** le résident n'est pas à jour → message d'encouragement
  collectif ; s'il est à jour → message de remerciement.
- **Exposé** : uniquement des **compteurs agrégés** (nombre payés / en attente / taux). **Jamais** de
  nom, de montant, ni d'identité d'un voisin. C'est une pression sociale douce et **anonyme**.
- **Intention** : ce calcul doit être fait **serveur** et ne renvoyer au résident que les 3 nombres —
  surtout pas la liste des unités (le prototype charge toute la résidence côté résident — §8/C2).

### 7.7 Génération et numérotation des reçus

`genererRecu` D:4779-4795 ; paiement espèces `enregistrerEspeces` D:5004-5050 ; paiement carte
`confirmPay` (cf §8/C8) :

```js
let _recuCounter = 1000;
function genererRecu(resident, montant, mode) {
  _recuCounter++;
  const recu = {
    num: 'REC-' + new Date().getFullYear() + '-' + _recuCounter,   // ⚠ compteur MÉMOIRE — §8/C9
    residentId: resident.id, nom: resident.nom, apt: resident.apt,
    montant, mode,
    dateStr: /* date du jour */, mois: /* mois/année */, timestamp: Date.now(),
  };
  recusDB.unshift(recu);
  return recu;
}
```

Paiement **espèces** (logique à conserver) :
```js
const nouveauTotal = (r.paye || 0) + montant;
const reste = r.montant - nouveauTotal;
if (nouveauTotal >= r.montant) { r.status='paid'; r.retard=0; r.paye=r.montant; genererRecu(r, r.montant,'especes'); }
else                          { r.status='partial'; r.paye=nouveauTotal; /* reste dû */ }
```
- Justificatifs de dépense : même schéma `DEP-<année>-<n>`.
- **Intention (comptable)** : numérotation **unique, séquentielle, sans trou, par résidence**, attribuée
  **côté serveur de façon transactionnelle** (le compteur mémoire du prototype génère des doublons —
  §8/C9). Un reçu n'est émis que pour un paiement **réellement enregistré**.
- **Implémentation (Étape 4)** : l'allocateur de numéros est **privé** et n'accepte qu'un client
  transactionnel (`Prisma.TransactionClient`) ; la seule API publique est `createReceipt()` /
  `createExpense()` (`src/server/finance/numbering.ts`), qui ouvrent elles-mêmes la transaction.
  Un `ROLLBACK` ne consomme donc aucun numéro — invariant testé dans `numbering.test.ts`.

### 7.7bis Statut de charge dérivé sur deux axes (correction Étape 4)

Le prototype confondait « partiel » et « en retard » en un seul statut mutuellement exclusif : une
charge partiellement payée **et** échue perdait l'une des deux informations. Le modèle corrigé dérive
(jamais ne stocke) **deux axes orthogonaux** :

- **Règlement** (`SettlementState`) — comparaison montant dû vs somme des allocations :
  `SETTLED` (soldé) · `PARTIAL` (partiel) · `UNSETTLED` (rien reçu).
- **Temporalité** (`TemporalState`) — comparaison de l'échéance à la date du jour (au jour près) :
  `UPCOMING` (à venir) · `DUE` (dû aujourd'hui) · `OVERDUE` (en retard).

Une charge peut être `{ PARTIAL, OVERDUE }`, `{ UNSETTLED, UPCOMING }`, etc. Implémentation :
`src/server/finance/status.ts` (`deriveSettlementState`, `deriveTemporalState`, `deriveChargeState`),
testée dans `status.test.ts`. Les relances (§7.1) s'appuient sur l'axe règlement + le seuil de retard.

---

## 8. Anomalies à NE PAS reproduire

Renvois vers `reference/audit/05-anomalies.md`. Le développement doit implémenter l'**intention**, jamais
ces comportements.

| # (audit) | Anomalie | Comportement voulu |
|---|---|---|
| **M1** | **Date d'échéance figée** `new Date('2026-06-10')` dans `joursAvantEcheance` (§7.2) | Comparer à la **date réelle** serveur. |
| **C9** | **Numérotation des reçus par compteur en mémoire** (réinitialisé au rechargement, doublons ; idem `DEP-`) | Séquence **unique/transactionnelle par résidence**, persistée serveur. |
| **C8** | **Paiement carte** : reçu généré et persisté **sans** persister le paiement ni le statut ; « succès » affiché sans traitement | Atomicité : pas de reçu sans paiement enregistré ; ne jamais afficher « Payé » sans transaction réussie. PSP à trancher. |
| **C7** | **Rendu `innerHTML` non échappé** (XSS stocké sur nom/description/message/nom de doc) | Rendu React (échappement natif) ; jamais d'injection HTML de données utilisateur. |
| **C1** | **SELECT anonyme sur `residents`** (par `code_acces`, avant auth) | Validation du code via fonction **serveur** ne divulguant rien ; aucun accès anonyme aux données résident. |
| **C2** | **Chargement de toute la résidence côté résident** (dont `code_acces`) | Un résident ne lit que **sa** fiche ; agrégats calculés serveur (§7.6). |
| **C3** | **Filtre `user_id` conditionnel** → écriture dans une résidence arbitraire | Toute requête scellée à la résidence de l'utilisateur authentifié (serveur). |
| **C4** | **Code d'accès prévisible** (`n° unité` + 4 chiffres), sans limite | Code aléatoire non devinable, **unique**, à usage unique, révocable, essais limités. |
| **C5** | **Liaison de dossier par email** (usurpation) | Liaison serveur contrôlée ; code à usage unique ; confirmation d'email. |
| **C6** | **Échec DB masqué** (données locales poussées comme si OK) | Distinguer autorisé/refusé ; afficher une **erreur**, jamais un faux succès. |
| **M2** | **Photos/documents en base64 en base** | **Storage d'objets** (Supabase Storage/S3) + URLs. |
| **M10** | **Erreurs DB silencieuses** (toast « sauvegardé » sur échec) | Remontée d'erreur explicite à l'UI ; pas de succès optimiste non confirmé. |
| **M3/M4** | **Écran Unités en dur / structures parallèles divergentes** (démo) | Une **source de vérité** unique, écrans pilotés par les données. |
| **M5** | **Signalement résident non vu du gérant** (démo) | Un signalement est visible du gérant dès sa création. |
| **M8** | **`mixte` ignoré par `vocab()`** | Vocabulaire per-unité en mixte (§7.3). |
| **M9** | **Historique de paiements dépendant de l'horloge** (mois « undefined ») | Historique tiré des paiements réels. |
| **m1** | **Nombres/période figés** (`24850`, `82%`, tarifs 199/499, « Juin 2026 » partout) | Valeurs issues des données ; période = mois courant réel. |
| **m5** | **« manquant » exclut les partiels** | Sommer le **reste dû** de toutes les unités non soldées. |
| **m6** | **Toggles d'automatisation non persistés** | Réglages persistés serveur. |
| — | **Tunnel « Stripe » décoratif** (« SSL 256-bit » mensonger) | Pas de promesse de sécurité non tenue ; PSP réel à trancher avant tout encaissement. |

---

## 9. Manques structurels — distinction PROPRIÉTAIRE / LOCATAIRE

Le prototype ne connaît qu'un rôle **« résident » unique** (`residents`, `_residentData`, un seul jeu de
droits). Le métier visé distingue :

- **Propriétaire** — souvent MRE, **redevable des charges**, **vote** en AG, doit la **transparence** sur
  l'usage de son argent. Peut être absent/à l'étranger.
- **Locataire** — occupe le lot, **signale les incidents**, reçoit les actualités ; **ne doit pas** voir
  les données financières/personnelles du propriétaire.

Un **lot** peut avoir : un propriétaire occupant (les deux rôles) ; un propriétaire + un locataire ; un
propriétaire sans locataire (vacant). **Je ne conçois pas la solution** (étape suivante) — je liste les
**points d'impact**, écran par écran :

| Écran / fonction | Décision impactée par la distinction |
|---|---|
| **Appel de charges / impayés** (2.1, 2.4) | Qui est **redevable** ? Le **propriétaire**. Les relances (§7.1) ciblent le propriétaire, pas l'occupant. « Retard » = retard du propriétaire du lot. |
| **Paiement** (3.2, 2.4) | Qui **paie** ? Le propriétaire (ou un mandataire). Un locataire ne voit pas le statut de paiement du propriétaire. |
| **Transparence des dépenses / budget** (3.3) | Qui **voit les dépenses** ? Le propriétaire (argument MRE). Le locataire : à trancher (probablement non, ou vue restreinte). |
| **Compteur agrégé** (§7.6) | Calculé sur les **lots/propriétaires** ; visible du propriétaire. Un locataire ne devrait pas voir la solvabilité collective. |
| **Votes** (2.9, 3.7) | **Seul le propriétaire vote**. Le locataire n'a pas de droit de vote. |
| **Signalements** (2.8, 3.4) | **Le locataire signale** (occupant). Le propriétaire peut aussi signaler s'il occupe. Le gérant voit qui a signalé (occupant). |
| **Liste des résidents / unités** (2.2, 2.3) | Afficher **le lot** avec **propriétaire ET occupant** distincts. Aujourd'hui une seule personne par ligne. |
| **Fiche & documents** (2.2, 3.5) | Séparer documents du **propriétaire** (titre, reçus, quote-part) et de l'**occupant** (bail, état des lieux). Le locataire **ne doit jamais voir** : coordonnées complètes du propriétaire, montant/quote-part, historique de paiement, code d'accès du propriétaire. |
| **Actualités / messages** (2.7, 3.6) | Diffusion : propriétaires et/ou occupants selon le sujet (une urgence technique → occupants ; une AG → propriétaires). |
| **Invitation par code** (§7.4) | Deux invitations possibles par lot : une pour le propriétaire, une pour le locataire, avec des droits différents. |
| **Quote-part / tantièmes** | **Absents** du prototype. Nécessaires pour répartir les charges et pondérer les votes. Point d'impact : appel de charges, bilan (2.11), votes (2.9). |

**À décider à l'étape suivante (hors de cette spec)** : modèle personne/lot/rôle ; qui du propriétaire ou
du locataire est destinataire de chaque flux ; gestion des tantièmes ; cas du propriétaire-occupant.

---

## 10. Traçabilité

- Textes → `messages/fr.json`, `messages/ar.json` (par domaine). Manques ar → `TRADUCTIONS-MANQUANTES.md`.
- Vocabulaire adaptatif → `messages/*.json` clé `vocabulaire` (§7.3bis).
- Écrans/champs → `audit/02-inventaire-fonctionnel.md`. Parcours → `audit/04-cheminement.md`.
- Anomalies → `audit/05-anomalies.md` (§8 ci-dessus renvoie aux identifiants Cx/Mx/mx).
