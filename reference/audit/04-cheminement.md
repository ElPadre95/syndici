# 04 — Cheminement / parcours utilisateur & touches mortes

## 1. Parcours GÉRANT

### Démo
1. Landing → « Se connecter » (`showLandingApp`) → écran rôle → « Espace Gérant » (`showLogin('gerant')`).
2. Login `loginWrap` : n'importe quel email/mot de passe (ou vide) → `doLogin()` → **aucune authentification**, entre dans l'app (`buildInterface`→`buildGerant`).
3. Dashboard → navigation sidebar (10 items) → toutes les pages. Actions terminales : enregistrer paiement espèces, ajouter dépense/résident/contrat/actu/vote, relancer (WhatsApp), clôturer vote, générer bilan, changer réglages/plan/type. Déconnexion → écran rôle.

### Connecté
1. Landing → écran rôle → « Espace Gérant » → **`afficherEcranAuth()`** (C:2311).
2. `loginSyndic()` : `supabase.auth.signInWithPassword(email,password)` (C:6450). Échec → message. Succès → app + `initData()` (charge la résidence liée à `user_id`, ou en **crée une** si aucune).
3. Mêmes pages, mais chaque mutation persiste dans Supabase. Déconnexion `logout()` → `logoutSyndic()` (signOut + reload).

## 2. Parcours RÉSIDENT

### Démo
- Écran rôle → « Espace Résident » → `showLogin('resident')` → `doLogin()` (aucune auth) → `buildResident()` avec `_residentId=2` (Sara en dur).

### Connecté
- Écran rôle → « Espace Résident » → `afficherEcranResident()` + onglet Connexion (C:2317).
- **Connexion** (`loginResident`, C:6634) : `signInWithPassword` → recherche du résident par `auth_id`, sinon par `email` (et rattache `auth_id`). Si aucun résident lié → message d'erreur. Puis `entrerEspaceResident` → `initDataResident` → app.
- **Inscription par code** (parcours de bout en bout, C:588-610, 6572) :
  1. Onglet « Inscription ». Champ **code d'accès** ; au blur → `prefillEmailFromCode()` (C:6528) fait un SELECT anonyme `residents.email` par `code_acces` et pré-remplit/verrouille l'email si valide.
  2. Saisie mot de passe + confirmation (`checkPasswordMatch`).
  3. `inscrireResident()` (C:6572) : SELECT `residents.*` par code (anonyme) → si code inconnu/`compte_cree` → erreur. Sinon `auth.signUp` + `auth.signInWithPassword` immédiat + `update residents {compte_cree:true, auth_id, email}`.
  4. `entrerEspaceResident(resident)` → espace résident.
- Le code est fourni au résident par le gérant (fiche résident → « Générer » `genererCodePour` puis « Envoyer » `partagerCodeAcces` via WhatsApp/presse-papier).

## 3. Chasse aux touches mortes — méthode vérifiable

### 3.1 Handlers → fonctions inexistantes
Extraction de tous les `on*="fn("` et comparaison aux `function` définies (script bash, les deux fichiers) :
**Aucun handler n'appelle une fonction inexistante.** Seuls `if` et `setTimeout` apparaissent (JS inline dans les attributs, ex. `onkeydown="if(event.key==='Enter')..."`), ce sont des faux positifs. → **Pas de bouton câblé vers une fonction absente.**

### 3.2 Fonctions définies jamais appelées (code mort) — vérifié par `grep`
- **Démo** : `pageTitles` (D:2432, 1 occurrence), `actusDepenses` (D:5067, 1 occ.), `residentsData` (D:1294, 1 occ.) → **définis, jamais lus**.
- **Connecté** : idem `pageTitles`/`actusDepenses`/`residentsData` ; **`checkAuth`** (C:6418) défini, **jamais appelé** ; `doLogin`/`loginWrap` **inatteignables** (showLogin retourne avant, C:2311-2320) ; `_simulateResidentMessageDemo` (C:5971) jamais appelé ; `simulateResidentMessage` réduit à `return` (C:5968) → le timer `startMsgSimulation` (toujours lancé C:2389) tourne toutes les 25 s pour ne rien faire.

### 3.3 Cibles DOM fantômes (`getElementById` sans élément)
- **`upload-zone`** : lu/écrit par `previewPhoto` (D:5353) et `removePhoto` (D:5363 / C:équivalent) — **n'existe nulle part dans le HTML** (la sheet signalement a `sig-upload-buttons`). → `getElementById('upload-zone').style` lève une **TypeError** (l'aperçu photo s'affiche mais une exception est levée juste après). Présent dans les deux versions.
- Les autres cibles vérifiées ponctuellement (`sideNav`, `pageContainer`, `msgFabWrap`, `msgPopup`, `recuModal`, `notifList`, sheets) **existent**.

### 3.4 Éléments cliquables sans effet réel
- Liens `href="#"` du footer et des « Mentions légales / Confidentialité / CGU » (D:730) → inertes.
- Boutons « 📄 » (télécharger reçu) dans certaines lignes de paiement résident : sans `onclick` (D:4388, 4390-4392) → **inertes**.
- `sendWA()` (D:5535) : ferme la sheet + toast, **n'envoie rien** (pas de wa.me pour ce bouton, contrairement à `sendRelance`).
- Tunnel de paiement carte : bouton « Payer » (`confirmPay`) affiche un succès **sans traiter la carte**.

### 3.5 Impasses / états sans retour
- **Démo `doLogin`** : aucune déconnexion réelle ; `logout`/`switchRole` ramènent à l'écran rôle (OK).
- **Connecté** : si `loginResident` réussit l'auth mais aucun résident n'est lié → message clair et retour au formulaire (pas d'impasse, C:6664-6669). Bien géré.
- **`upload-zone`** : après une photo de signalement, l'exception (3.3) n'empêche pas la fermeture de la sheet, mais peut laisser des états incohérents selon le navigateur — **comportement non déterminé sans exécution**.
- Pas d'écran/modale piégeant l'utilisateur repéré ; toutes les sheets ont Annuler/✕ et Escape ferme les overlays (D:5881).

## 4. Cohérence des clés de traduction — décompte

Décompte des clés uniques par objet de langue (parse regex ; **quelques faux positifs** dus aux `:` dans les valeurs comme `vote_limite:'Deadline:'` — l'ordre et l'écart nl restent robustes) :

| Langue | Clés (approx.) | État |
|---|---|---|
| fr | ~405 | référence, complet |
| ar | ~399 | quasi complet |
| en | ~383 | quasi complet |
| es | ~352 | incomplet (manque ~70) |
| de | ~352 | incomplet (manque ~70) |
| **nl** | **~209** | **gravement incomplet (~213 clés manquantes)** |

- **Mécanisme** : le vocabulaire applicatif néerlandais a été collé dans l'objet `en` (D:1467/C:1511) où il est écrasé (mort) au lieu d'être dans `nl`. L'objet `nl` (D:1525/C:1569) s'arrête aux clés landing/sidebar/btn/status/app_ et **omet** tout le bloc `msg_/succ_/recu_/voc_/dep_/vote_/doc_/sig_/relance_/abo_/fin_/hist_/mois_/ctr_/bilan_`.
- **Clés manquantes notables communes à es/de/nl** (rendu en français via fallback) : `abo_*`, `bilan_*` pour es ; `app_nationalite`, `app_telephone`, `app_tous` absents partout sauf fr/ar.
- **Impact concret** : un propriétaire MRE néerlandophone (2 résidents sur 10 dans les données : Chraibi, Van der Berg) voit une interface **majoritairement en français** dès qu'il quitte l'accueil. C'est précisément la cible « transparence pour l'absent » qui est mal servie.

## 5. Synthèse touches mortes
- Aucun handler cassé (fonctions toutes définies).
- Code mort : `pageTitles`, `actusDepenses`, `residentsData` (2 versions) ; `checkAuth`, `doLogin`/`loginWrap`, simulation messages (connecté).
- 1 cible DOM fantôme active : `upload-zone` (exception à la prévisualisation photo de signalement).
- Quelques boutons décoratifs (📄 reçu, footer, `sendWA`) et le tunnel carte non fonctionnel.
