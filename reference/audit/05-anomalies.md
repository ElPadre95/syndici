# 05 — Anomalies (par sévérité)

Sévérité : CRITIQUE (sécurité/perte de données/comptable) · MAJEURE (fonctionnel cassé ou faux) · MINEURE (cosmétique/robustesse).
`C:` = connecté, `D:` = démo. « RLS » = Row Level Security Supabase, non visible dans le code (voir note finale).

---

## CRITIQUE

### C1. Lecture anonyme de la table `residents` avant authentification
- **Où** : `prefillEmailFromCode` C:6535 (`select('email,compte_cree').eq('code_acces',code)`) ; `inscrireResident` C:6594 (`select('*').eq('code_acces',code)`).
- **Fait** : requêtes exécutées **sans session** (au blur du champ code, puis à l'inscription). `select('*')` renvoie toutes les colonnes du résident.
- **Devrait** : ne jamais exposer les données résident à un non-authentifié ; la vérification du code devrait passer par une fonction serveur (RPC/Edge Function) renvoyant le strict minimum.
- **Impact** : si une policy SELECT anonyme existe (ce que ces appels supposent), un attaquant qui devine un code (préfixe = n° d'appartement, 4 chiffres, cf C4) lit nom, email, téléphone, montant dû, retard, `auth_id`, `code_acces`. Fuite de données personnelles → RGPD (propriétaires UE) + loi 09-08 (Maroc). **Confirme points 1.**
- **Réserve** : l'effet réel dépend des policies RLS (non lisibles ici). Si aucune policy n'autorise l'anonyme, ces appels échouent silencieusement et l'inscription est cassée. **Comportement non déterminé par lecture statique — à trancher en testant la requête anonyme.**

### C2. `chargerResidents` charge toute la résidence (dont `code_acces`) pour tout contexte connecté
- **Où** : C:6079 `select('*').eq('residence_id',_residenceId)` ; mapping incluant `codeAcces` C:6098. Appelé aussi côté résident via `initDataResident` C:6701.
- **Fait** : un résident connecté charge en mémoire (`residentsDB`) les données de **tous ses voisins**, y compris leur code d'accès et montants.
- **Devrait** : un résident ne devrait lire que sa propre fiche.
- **Impact** : un voisin peut lire/exporter les données de tous, et usurper un compte via le code (cf C4/C6). **Confirme point 2.** (Contingent RLS.)

### C3. `initData` : filtrage `user_id` conditionnel → écriture dans une résidence arbitraire
- **Où** : C:6013-6015 `let query=...select('*'); if(userId) query=query.eq('user_id',userId); ...limit(1)`.
- **Fait** : si `userId` est absent (pas de session), le filtre saute et `.limit(1)` prend **une résidence quelconque** ; `_residenceId` pointe dessus et l'app y écrit.
- **Impact** : en l'absence d'auth (ou si `getUser()` renvoie null), un utilisateur peut lire/écrire dans la résidence d'un autre syndic. **Confirme point 5.**

### C4. Codes d'accès prévisibles, sans limite de tentatives
- **Où** : `addNewResident` C:5478 et `genererCodePour` C:5529 : `apt.toUpperCase().replace(/\s/g,'') + Math.floor(1000+Math.random()*9000)`.
- **Fait** : code = **numéro d'appartement** (visible/devinable) + 4 chiffres. ~10 000 combinaisons par appartement, `Math.random` non cryptographique, aucune unicité vérifiée, aucun rate-limit.
- **Impact** : brute-force trivial ; combiné à C1, énumération des résidents et création de comptes à leur place. **Confirme point 4.**

### C5. `loginResident` : rattachement d'un dossier résident par email
- **Où** : C:6652-6659 : après auth, si aucun résident par `auth_id`, repli `select('*').eq('email',email)` puis `update auth_id`.
- **Fait** : quiconque crée un compte Supabase avec l'email d'un résident (l'`inscrireResident` fait `signUp`+`signInWithPassword` immédiat → **email-confirm probablement désactivé**) revendique le dossier de ce résident.
- **Impact** : usurpation du dossier d'un résident dont on connaît l'email. **Confirme point 3.** (Dépend des réglages Supabase, non visibles.)

### C6. `initDataResident` masque les blocages de sécurité (échec silencieux affiché comme succès)
- **Où** : C:6696-6721 : en cas d'échec DB / retour vide (RLS), conserve `_residentData` local et le **pousse dans `residentsDB`** (C:6710-6715).
- **Fait** : l'UI affiche les données comme si tout allait bien même quand la base a tout refusé.
- **Impact** : impossible de distinguer « autorisé » de « refusé » ; masque une RLS mal configurée en développement → faux sentiment de sécurité, régressions non détectées. **Confirme point 6.**

### C7. XSS stocké via `innerHTML` sans échappement
- **Où** : toutes les fonctions `htmlXxx` interpolent des champs utilisateur dans `innerHTML` sans échappement — ex. nom résident (C:2623), description signalement (C:2663, `htmlGerantSignalements`), note de paiement, nom de document, titre/message d'actualité.
- **Fait** : un résident saisissant `<img src=x onerror=...>` dans une description de signalement / nom de document / message exécute du JS chez le gérant (et inversement).
- **Impact** : vol de session Supabase, actions au nom du gérant. Aggravé par le contexte multi-utilisateurs de la version connectée. **Non listé dans le brief — trouvé à la lecture.**

### C8. Paiement carte : succès affiché sans traitement ni persistance
- **Où** : `confirmPay` D:4797 / C:4843.
- **Fait** : les champs carte sont **ignorés** ; l'écran de succès + le reçu sont générés. En connecté, `confirmPay` **ne persiste NI le paiement NI le statut** (pas de `savePaiementToDB`/`updateResidentDB`) — seul le reçu est inséré. Le paiement espèces, lui, persiste (C:5075-5078).
- **Devrait** : soit un vrai PSP (hors périmètre actuel, cf point non-tranché n°3), soit ne pas afficher « Paiement réussi ».
- **Impact** : (1) **erreur silencieuse** — l'UI affiche « payé », un reçu numéroté est créé, mais après rechargement le paiement carte a disparu (statut résident non mis à jour) alors qu'un reçu orphelin subsiste en base ; (2) mensonge fonctionnel (le « SSL 256-bit via Stripe » est décoratif). **Erreur silencieuse — point demandé en 05.**

### C9. Numérotation des reçus non fiable (exigence comptable)
- **Où** : `genererRecu` D:4779 / C:4824 : `_recuCounter=1000` en mémoire, `num='REC-'+année+'-'+counter`.
- **Fait** : compteur réinitialisé à chaque rechargement, **jamais re-synchronisé** sur le max existant en base ; `saveRecuToDB` insère sans contrainte d'unicité (num = colonne texte). Idem `_depRecuCounter=5000` pour les justificatifs de dépense.
- **Impact** : **numéros de reçu en doublon garantis** entre sessions/rechargements et entre syndics ; séquence non continue. Rédhibitoire pour une pièce comptable. **Confirme point 9.**

---

## MAJEURE

### M1. Date d'échéance figée dans `joursAvantEcheance`
- **Où** : D:5085 / C:5114 : `const today = new Date('2026-06-10')`.
- **Fait** : le compte à rebours des contrats est calculé par rapport au **10 juin 2026 en dur**, pas à la date réelle.
- **Impact** : au 2026-08-10, un contrat échu le 20 juin/5 juillet apparaît encore « à venir » → alertes fausses, l'argument « suivi des échéances » ne fonctionne pas. **Confirme point 8.**

### M2. Photos/documents en base64 dans des colonnes Postgres
- **Où** : `depenses.photo`, `documents.data`, `signalements.photo` (C:6173/6207/6319).
- **Fait** : les images sont stockées en base64 (≈ +33 % de taille) dans des colonnes texte, jamais dans Supabase Storage.
- **Impact** : lignes énormes, requêtes `select('*')` qui rapatrient tout le binaire, quotas DB explosés, pas de CDN/miniatures. Ne passe pas l'échelle. **Confirme point 11.**

### M3. Écran Appartements (démo) = maquette figée contredisant les données
- **Où** : D:3354-3362.
- **Fait** : liste de 8 appartements **codée en dur**, avec des résidents villa (Chraibi/Ziani/Moussaoui) ré-étiquetés en appartements et tous à « 650 MAD ». KPI en tête calculés sur residentsDB (10) → incohérence 8 vs 10.
- **Impact** : écran faux en démo. **Corrigé en connecté** (C:3389 data-driven).

### M4. Structures de données parallèles et contradictoires (démo)
- **Où** : `residentsDB` (10, D:2525, canonique), `residentsData` (3, D:1294, **mort**), liste appts en dur (8, D:3354), `paiementsDB` (5, apt divergents E2/F1 pour des villas V2/V3), `signalements`/`mesSignalements`.
- **Fait** : Sara Tahiri est apt **B2** (residentsDB) / **B3** (residentsData, sheet-pay, profil) ; Chraibi est **V1 villa** (DB) / **D1** (residentsData) / **D1** (liste appts).
- **Impact** : incohérences d'affichage selon l'écran. `residentsData` étant mort, les contradictions actives sont surtout B2/B3 et la liste appts figée. **Confirme point 14** (avec la nuance : `residentsData` est du code mort).

### M5. Déconnexion résident→gérant des signalements (démo)
- **Où** : `submitSignalement` D:5496 : ajoute à `mesSignalements` seulement, **pas à `signalements`**.
- **Impact** : en démo, un signalement créé côté résident **n'apparaît jamais** côté gérant. **Corrigé en connecté** (C:5583 `saveSignalementToDB` + `signalements.unshift`).

### M6. Néerlandais gravement incomplet (multilingue)
- **Où** : objet `nl` D:1525 / C:1569 (~209 clés vs ~405 fr) ; contenu nl perdu dans l'objet `en` (D:1467/C:1511).
- **Impact** : un MRE néerlandophone (2/10 résidents) voit l'app majoritairement en français. Va à l'encontre de la promesse « transparence pour l'absent ». **Confirme point 13.**

### M7. RTL arabe non appliqué au layout
- **Où** : CSS `[dir="rtl"]` limité à 3 classes (D:477/489/490) ; attribut `dir` jamais posé ; démo pose seulement `body.style.direction` (D:1969).
- **Impact** : en arabe, le flux de texte s'inverse (démo) mais la mise en page (sidebar à gauche, marges) reste LTR ; les composants RTL prévus ne s'activent pas. **Confirme point 12 (partiellement)** — à préciser par exécution de la version connectée.

### M8. `mixte` ignoré par `vocab()`
- **Où** : `vocab()` D:1279 : `isVilla = type==='villa'` → mixte traité comme immeuble ; alors que `vocabResident`/`countUnites`/`kpiUnitesLabel` gèrent mixte.
- **Impact** : vocabulaire incohérent en mode mixte selon l'écran.

### M9. Historique de paiements dépendant de l'horloge (démo)
- **Où** : `renderFicheResident` D:2788-2802 : `new Date().getMonth()` avec `mois` = jan..juin (6 éléments).
- **Impact** : après juin, `mois[6]`/`mois[7]` = `undefined` → mois « undefined 2026 » affichés. Corrigé en connecté (historique tiré de `paiementsDB`).

### M10. Erreurs DB silencieuses (peu de gestion d'erreur)
- **Où** : 65 `await` pour 8 `try`/8 `catch` (connecté). La plupart des `saveXToDB`/`chargerX` gèrent l'échec par `console.error`+`return` sans retour UI ; `initData` avale les erreurs par loader (console.warn).
- **Impact** : un échec d'écriture (RLS, réseau) laisse l'UI afficher un succès (toast « sauvegardé 💾 ») ; l'utilisateur croit ses données enregistrées. **Confirme point 10** et recoupe C6/C8.

### M11. `langueLabel` incomplet → crash latent (démo)
- **Où** : `langueLabel` D:2593 = {fr,en,nl,ar} ; `openRelanceResident` D:3167 fait `langueLabel[r.langue].split(...)`.
- **Impact** : un résident langue `es`/`de` → `undefined.split` → exception. **Corrigé en connecté** (C:3200 ajoute `||'🇫🇷 Français'`). `relanceMessages` reste limité à fr/en/nl/ar (es/de → message en français).

---

## MINEURE

### m1. Nombres magiques / valeurs figées
- Trésorerie initiale `24850` en dur (D:3217) ; KPI budget résident `24 850`/`82%` en dur (D:4474-4476) ; date bilan « 10 juin 2026 » (D:5155) ; période « Juin 2026 » figée dans tout l'i18n (`app_charges_juin`, `app_historique_juin`, `app_dashboard_sub` « Al Firdaous · Casablanca · Juin 2026 » même en connecté C:1409). Corrigés partiellement en connecté (soldeInitial=0, titres dynamiques) mais le « mois courant » reste figé à juin partout.
- Tarifs 199/499/devis en dur (landing + réglages).
- `_residentId=2` (Sara) en dur (D:2356 / C:2405).

### m2. `upload-zone` : cible DOM fantôme
- `previewPhoto`/`removePhoto` (D:5346/5359) → TypeError (cf 04 §3.3).

### m3. `startMsgSimulation` tourne à vide (connecté)
- Timer 25 s appelant un no-op (C:5968) ; consommation inutile.

### m4. Dépendance réseau externe non essentielle
- `loadCountries` (RestCountries, D:3055/C:3074) : appel réseau pour l'autocomplétion nationalité ; fallback OK mais dépendance externe live pour un champ secondaire.

### m5. `manquant` (dashboard) exclut les partiels
- `htmlGerantPaiements` D:3382 : `manquant = somme montant des status==='late'` seulement ; le reste dû des « partial » n'est pas compté alors qu'ils figurent dans la liste impayés.

### m6. Toggles d'automatisation non persistés (connecté)
- `toggleAuto` (C:3886) modifie `syndicData` mais n'appelle pas `saveResidenceSettingsDB` ; ces réglages sont éphémères (et absents du schéma `residences`).

### m7. `closeSuccess` force « 650 MAD » (démo)
- D:4957 : le hero repasse à « 650 » en dur, faux pour un résident villa (1200).

---

## Ce qui casserait à l'échelle (100 résidences, 1000 unités)
- `select('*')` sur `residents`/`depenses`/`documents` sans pagination → rapatrie tout, y compris le base64 des photos (M2) → temps de chargement et mémoire non tenables.
- Rendu par `innerHTML` de toute la liste à chaque `navTo` → recalcul O(n) systématique, pas de virtualisation.
- Numérotation reçus en mémoire (C9) → collisions massives dès plusieurs postes/syndics.
- Recherche/filtre résidents entièrement client-side sur le DOM (D:2707) → lourd à 1000 lignes.
- Messagerie 100 % en mémoire → inutilisable en multi-appareils / historique.

## Note transversale sur la sécurité (RLS)
Les points C1-C6 décrivent ce que **le code client tente**. Leur exploitabilité réelle dépend des
policies RLS du projet Supabase, **non incluses dans les fichiers audités**. Ce qui est certain par
lecture statique : le client est **écrit en supposant** des accès larges (SELECT anonyme sur `residents`,
SELECT de toute la résidence côté résident, écriture sans vérification de propriété), et gère les refus
en les masquant (C6). Trancher définitivement exige d'inspecter le dashboard Supabase ou d'exécuter les
requêtes en anonyme/authentifié-voisin.
