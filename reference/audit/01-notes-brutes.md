# 01 — Notes brutes (lecture séquentielle)

Convention : `D:xxxx` = index-demo.html ligne xxxx ; `C:xxxx` = index-connecte.html ligne xxxx.
Notes prises au fil de la lecture. Faits vérifiés vs déductions signalés.

---

## DEMO 1-545 (head + script précoce + 2 blocs CSS)

- D:2 `<html lang="fr">` — langue fixée à fr en dur dans la balise.
- D:6 titre "Syndici — La gestion de syndic réinventée". (Le projet s'appelle "Syndici" dans le code, "Syndic Maroc"/"Syndici" dans le brief.)
- D:9 Google Fonts (Plus Jakarta Sans, DM Serif Display) chargées via CDN externe.
- D:10-32 **script précoce** : `toggleLangMenu(btn)` (ouvre/ferme menus langue nav+app), `setLang(lang,source)` = stub qui délègue à `window._setLangFull` (défini plus tard dans le script principal). Listener document click qui ferme les menus langue. Donc si le script principal ne charge pas, setLang est inerte.
- D:33-181 **CSS bloc 1 = landing page** (`.landing`, `.land-nav`, `.land-hero`, mockup dashboard, sections problème/features/pricing/CTA/footer, responsive 768px). Pur présentationnel.
- D:182-545 **CSS bloc 2 = application** : variables `:root` (couleurs, rayons, ombres, `--sw:72px` largeur sidebar) D:183-206. Écrans role-screen (211), login (224-241), app/sidebar/main/page (243-273), topbar/cards/grids/kpi/rows/pills/progress/actu/dep/toggle/docs/profil/notif-panel/overlay-sheet/toast/recu-modal/msg-popup/msg-fab/success/responsive/mobile-nav.
- **RTL** : seules règles `[dir="rtl"]` présentes = D:477 (.msg-popup), D:489 (.msg-fab-wrap), D:490 (.msg-fab-badge). Aucune autre règle RTL dans le CSS. Layout global (sidebar à gauche via `left:0`, `margin-left`) non adapté RTL. À vérifier : pose de l'attribut `dir` côté JS.
- `--sw` largeur sidebar redéfinie à 0 en mobile (D:503).
- Mobile nav + menu "Plus" (mobileMoreMenu) présents D:513-544.

## DEMO 546-1186 (markup body statique)

Architecture DOM : coquille statique + conteneurs remplis en JS.
- Conteneurs dynamiques : `#pageContainer` D:823 (contenu des pages), `#sideNav` D:785 (nav sidebar), `#mobileNav` D:805, `#notifList` D:830.
- Écrans plein écran : `#landing` D:550, `#roleScreen` D:738, `#loginWrap` D:761, `#app` D:780, `#successScreen` D:1174, `#toast` D:1185, `#notifPanel` D:828.

### Landing (550-735) — page marketing
- Sélecteur langue 6 langues : fr/en/nl/ar/es/de, appelle `setLang('xx','nav')` D:565-570.
- CTA "Se connecter" → `showLandingApp()` D:574 ; dropdown → `showLogin('gerant')` / `showLogin('resident')` D:576,583.
- Section features onglets : `switchTab('habitant'/'gerant',this)` D:657-658.
- **Feature affichée D:670 : "Paiements directs sur votre compte … via Stripe Connect"** (mention Stripe Connect en dur).
- **Tarifs codés en dur** : Starter 199 (D:683), Pro 499 (D:692), Entreprise "Sur devis" `#price-enterprise-val` (D:700).
- Footer liens legal (mentions/confidentialité/CGU) = `href="#"` inertes D:730.

### Role screen + login (738-777)
- `showLogin('gerant'/'resident')` D:745,751 ; `backToLanding()` D:739 ; `backToRole()` D:762.
- Login : champ email `#loginEmail` D:771, champ password sans id D:773 (onkeydown Enter→doLogin), `doLogin()` D:774. Hint "Mode démo — connexion directe" D:775.

### App shell (780-825)
- Sidebar : `#sideNav` vide (rempli JS), `#sideAvatar` "MK" D:786, bouton `switchRole()` D:787, sélecteur langue app `setLang('xx','app')` D:794-799.
- Topbar : `#backBtn goBack()` D:811, `#pgTitle`/`#pgSub`, `#notifBtn` D:820.

### Sheets/modales statiques (833-1171)
- `sheet-especes` D:836 : select `#especes-resident`, `#especes-montant`, `#especes-date`, `#especes-note` → `enregistrerEspeces()` D:872.
- `sheet-pay` D:878 : **tunnel carte** — sous-titre "🔒 Paiement sécurisé · SSL 256-bit via Stripe" D:883 ; `#pay-amount-display` "650 MAD" en dur D:887 ; desc "Charges Juin 2026 · Appartement B3" D:888 ; inputs carte/exp/cvv/nom (formatage JS inline) ; bouton `confirmPay()` "🔒 Payer 650 MAD" D:900 (montant en dur).
- `sheet-signal` D:906 : loc/cat/desc/photo(base64)/urgence → `submitSignalement()` D:953. Photos via `previewPhoto`.
- `sheet-wa` D:959 : message WhatsApp individuel → `sendWA()` D:988.
- `sheet-relance` D:994 : relance impayé, dest multiples `#relance-dests`, aperçu éditable, bouton `simulateResidentPay()` D:1019, `sendRelance()` D:1029.
- `sheet-ajouter-depense` D:1035 : photo facture (input file base64, accept image + pdf D:1057), `#dep-cat` select dynamique, desc/montant/date → `addDepense()` D:1070.
- `sheet-ajouter-apt` D:1074 : nouveau résident — prenom/nom/email/tel/nationalité/langue(datalist filtrée)/type logement(appartement|villa, caché par défaut D:1105)/#new-apt/#new-montant/statut initial → `addNewResident()` D:1128.
- `sheet-nouvelle-actu` D:1133 : type(select)/titre/message → `publierActu()` D:1142.
- `sheet-nouveau-contrat` D:1146 : nom/fournisseur/montant/echeance → `ajouterContrat()` D:1156.
- `sheet-nouveau-vote` D:1159 : titre/desc/date → `creerVote()` D:1169.
- successScreen D:1174 : `downloadLastRecu()` D:1179, `closeSuccess()` D:1180.

Fonctions référencées (à confronter aux définitions plus loin) : toggleLangMenu, setLang, showLandingApp, showLogin, backToLanding, backToRole, doLogin, switchTab, switchRole, goBack, toggleNotif, closeSheet, enregistrerEspeces, confirmPay, previewPhoto, removePhoto, selectUrgence, submitSignalement, sendWA, simulateResidentPay, sendRelance, previewDepPhoto, removeDepPhoto, addDepense, filterDatalistNew, selectNewType, selectNewStatus, addNewResident, publierActu, ajouterContrat, creerVote, downloadLastRecu, closeSuccess.

## DEMO 1187-1486 (script : landing, état global, données démo, i18n début)

### Navigation / landing
- `navHistory=[]` D:1192 ; `goBack()` dépile 2 et navTo(prev) D:1194-1199 (si <2, return).
- `backToLanding`/`showLandingApp`/`switchTab` D:1201-1216.

### État global + données démo codées en dur
- `currentRole`, `currentPage`, `_photoData`, `_waMode`, `_waSigId`, `_relanceName` D:1221-1226.
- **`signalements`** (gérant) D:1229-1233 : 3 entrées, dates en dur ('3 juin 2026', '28 mai 2026', '20 mai 2026').
- **`mesSignalements`** (résident) D:1236-1239 : 2 entrées.
- **`conversations`** D:1242-1255 : objet clé = id résident (2, 6, 3), messages en dur avec time/date ('Aujourd\'hui', 'Hier', '2 juin').
- **`syndicData`** D:1259-1276 : residenceNom 'Al Firdaous', adresse Casablanca, chargesMontant **650**, chargesVilla **1200**, echeance '1er du mois', gerantNom 'Mohammed Karimi', gerantEmail 'm.karimi@gmail.com', abonnement 'Pro · 499 MAD/mois', **plan 'pro'** (détermine accès votes), autoRelance true/autoFrais false/autoSMS true/autoRapport true, **type 'immeuble'** ('immeuble'|'villa' — commentaire ne mentionne pas 'mixte'), **nbUnites 10**.
- **`vocab(key)`** D:1279-1291 : `isVilla = syndicData.type === 'villa'`. **Ne teste que 'villa'** ; un type 'mixte' (pourtant prévu, cf `voc_type_mixte`) retombe donc sur le vocabulaire 'immeuble'. Abstraction binaire, pas ternaire. À confronter au reste.
- **`residentsData`** D:1294-1298 : **structure PARALLÈLE** listant seulement **3 résidents** (Sara Tahiri B3, Youssef Chraibi D1, Omar El Fassi A3) avec apt/phone/retard/montant. Valeurs de montant 650 partout. (à comparer à residentsDB/paiementsDB — cf point 14.)

### i18n
- `currentLang='fr'` D:1303 ; `langFlags`/`langNames` 6 langues D:1305-1306.
- `translations` objet D:1308+. Objet `fr` D:1309-1421, `en` D:1423-…
- **ANOMALIE MAJEURE de structure i18n** : les gros "blob lines" contiennent des clés de PLUSIEURS langues empilées.
  - D:1363 (dans l'objet **fr**) : une seule ligne qui empile successivement des valeurs en **allemand** (`relance_auto_envoyee:'Auto-Erinnerung gesendet'`, `fin_tresorerie:'Verfügbares Guthaben'`, `mois_jan:'Januar'`, blocs `bilan_*` en allemand), puis en **néerlandais** (`ctr_titre:'Contracten & deadlines'`, `bilan_btn:'Jaarverslag genereren (ALV)'`), puis **espagnol** (`fin_tresorerie:'Tesorería disponible'`, `mois_jan:'Enero'`), puis **anglais** (`fin_tresorerie:'Available funds'`, `mois_jan:'January'`), puis enfin **français** (`fin_tresorerie:'Trésorerie disponible'`, `mois_jan:'Janvier'`). Clés dupliquées → **la dernière (française) l'emporte** dans l'objet fr (sémantique JS "last wins"). Vérifié par lecture ; l'effet net dépend de l'ordre.
  - D:1467 (dans l'objet **en**) : commence en **néerlandais** (`s_messages:'Berichten'`, longue série nl) ; D:1468 re-déclare les mêmes clés en **anglais** → l'anglais (dernier) gagne.
  - Conséquence probable (à confirmer sur objets nl/ar/es/de) : le contenu néerlandais/allemand/espagnol a été dumpé par copier-coller dans fr et en au lieu d'être placé dans les bons objets ; les objets nl/de/es risquent d'être incomplets. Mécanisme fragile.
- Clés `voc_type_mixte` existent (D:1363 fr, D:1467 en) : le "mixte" est prévu côté libellés mais pas côté `vocab()`.
- `feat_g4_desc` mentionne "Stripe Connect" (D:1341 fr, D:1451 en).
- `feat_g3` : "20 MAD de frais après X jours" (D:1340).

## DEMO 1487-1786 (suite i18n : fin en, nl, ar, es début)

- Objet **en** se termine D:1523.
- Objet **nl** D:1525-1623 : contient landing + sidebar (s_dashboard…s_budget D:1566-1568) + btn/status (1569-1572) + app_* (1573-1622). **MAIS n'a PAS le grand blob de vocabulaire applicatif** : pas de `s_messages`, `msg_*`, `succ_*`, `recu_*`, `voc_*`, `dep_*`, `s_votes`, `vote_*`, `doc_*`, `sig_*`, `relance_*`, `abo_*`, `fin_*`, `hist_*`, `mois_*`, `ctr_*`, `bilan_*`. (Il a quelques `transp_*` inline D:1616.)
  - **Confirmé** : le contenu néerlandais de ces clés existe bien mais a été collé PAR ERREUR dans l'objet **en** (D:1467, en tête, avant redéclaration anglaise D:1468) où il est **mort** (écrasé). Donc l'objet nl est réellement amputé de tout ce vocabulaire → en mode nl, ces clés tombent en fallback. **Confirme point 13 (nl le plus incomplet), avec mécanisme identifié.**
- Objet **ar** D:1625-1724 : complet, grand blob en arabe D:1669. RTL du contenu OK au niveau des chaînes ; question de l'attribut `dir` reste ouverte.
- Objet **es** D:1726-… : grand blob espagnol D:1770.
- **Aucun objet `de:` (allemand) rencontré à ce stade** alors que langFlags/langNames incluent `de`. Le contenu allemand n'apparaît que comme doublons morts dans le blob fr D:1363. À confirmer : existence d'un objet `de` plus loin. Si absent → allemand quasi non traduit (fallback).
- `voc_type_mixte` présent dans fr/en/ar/es (libellé "Mixte") — confirme que le mode mixte est prévu côté UI.

## DEMO 1787-2066 (fin es, objet de, t(), setLang, translateLanding)

- Objet **es** se termine D:1825.
- **Objet `de` (allemand) EXISTE** D:1827-1926, complet (landing + sidebar + grand blob applicatif D:1871 + app_*). Donc l'allemand est bien traduit en tant qu'objet — **contrairement à ma déduction précédente** ; les doublons allemands du blob fr D:1363 sont juste du copier-coller mort. Correction notée.
- Bilan langues DEMO : fr, en, ar, de, es = complets (avec blob applicatif). **nl = amputé** du blob applicatif (msg/vote/doc/sig/dep/recu/voc/ctr/bilan/abo/fin/hist/mois). Donc **nl est la seule langue réellement incomplète** dans la démo.
- **`t(key)`** D:1929-1936 : adaptation villa (`s_appartements`/`app_appts` → `voc_villas` si type villa), puis fallback **currentLang → fr → nom de clé**. Donc les clés nl manquantes s'affichent **en français** (pas en clé brute).
- **`setLang`** D:1947 délègue à `_setLangFull` D:1949.
- **RTL DEMO** D:1968-1970 : `document.body.style.direction = lang==='ar' ? 'rtl':'ltr'` + police Noto Sans Arabic. **L'attribut `dir` N'est PAS posé** ; seul le style CSS `direction` de body est modifié. Conséquence : le flux de texte passe en RTL, mais les règles `[dir="rtl"]` du CSS (D:477/489/490) NE s'appliquent pas (sélecteur attribut non satisfait), et le layout global (sidebar left:0, margin-left) reste LTR. **RTL partiel** dans la démo (à confronter au point 12, qui vise probablement la version connectée — à vérifier séparément).
- `_setLangFull` traduit tous `[data-t]` (innerHTML), appelle `translateLanding`, reconstruit la sidebar puis `navTo(currentPage)`.
- **Sidebar gérant** (10 items) D:1983-1994 : dashboard, residents, appartements(badge=late+partial), paiements, messages(badge=nb conversations), depenses, actualites, signalements(badge non résolus), votes, parametres. Référence `residentsDB` (défini plus loin).
- **Sidebar résident** (8 items) D:1997-2006 : accueil, paiements(badge si non payé), messages, actualites(badge:3 en dur), signalements, votes, depenses(libellé budget), documents. Référence `_residentData`.
- Toast multilingue en dur D:2011.
- `translateLanding(lang)` D:2014+ : traduit la landing par sélecteurs DOM positionnels (querySelectorAll + index). Fragile si markup change.

## DEMO 2066-2799 (pricing i18n, login/auth, nav, residentsDB, résidents)

- `translateLanding` : `priceData` 6 langues D:2078-2133 ; `enterpriseVals` D:2147 ; footer/login/role traduits par sélecteurs positionnels. Login labels par dictionnaires en dur (backTexts, emailLabels…) D:2240-2256.
- **`showLogin(role)`** D:2260 : place currentRole, affiche loginWrap, place placeholder email en dur ('gerant@syndici.ma' / 'sara.tahiri@gmail.com').
- **`doLogin()`** D:2286-2290 : **AUCUNE authentification** — masque login, montre app, `buildInterface()`. N'importe quel email/mot de passe (ou vides) connecte. (Attendu en démo, mais aucun contrôle.)
- `switchRole` D:2292 / `logout` D:2299 : identiques (retour roleScreen + stop simulation messages). `logout` référencé ? à vérifier.
- `buildInterface` → buildGerant/buildResident D:2309.
- `buildGerant` D:2315 : `notifList` **HTML codé en dur** (noms, "650 MAD", "Il y a 2 heures", "Rapport Mai 2026") D:2319-2323 ; nav 10 items ; `startMsgSimulation()`.
- **`startMsgSimulation`** D:2345 : simulate messages entrants via setTimeout 8s puis setInterval 25s (démo).
- **`_residentId = 2`** en dur D:2356 (Sara). `buildResident` D:2358 : `_residentData = residentsDB.find(id===2)`.
- `buildNav` D:2380 : sidebar + mobile nav (4 principaux + "Plus" `toggleMobileMore`).
- **`pageTitles`** const D:2432-2445 : contient un **bug de template** — sous-titre `appartements` en **guillemets simples** avec `${residentsDB.length}` littéral non interpolé D:2435. MAIS `navTo` redéfinit un objet local `titles` en backticks (interpolé) D:2469-2483 et utilise `titles[id]`, pas `pageTitles`. → **`pageTitles` semble MORT/inutilisé** (le bug est latent, jamais affiché). Usage réel à confirmer par recherche.
- **`navTo(id)`** D:2447 : push navHistory (cap 20), toggle boutons actifs, titres via `titles`, vide `#pageContainer`, crée div.page, appelle renderResidentPage / renderGerantPage, `updateMsgFab()`.
- **`renderGerantPage`** D:2509 switch → html*() par page.
- **`residentsDB`** D:2525-2536 : **structure canonique, 10 résidents.** Types mélangés appartement/villa (ids 6,7,8,10=villa ; 9=appartement 'G2' ; 1-5=appartement). montant 650 appt / 1200 villa. 5 étrangers/10 (Sara +33 fr, Chraibi +31 nl, Moussaoui +44 en, Van der Berg +31 nl, Smith +44 en). Conforme au brief.
  - **CONTRADICTIONS de données (point 14 confirmé)** :
    - Sara Tahiri : residentsDB id:2 **apt B2** ; mais `residentsData` D:1295 = **apt B3** ; `sheet-pay` HTML = "Appartement B3" ; landing mockup = "B2". apt incohérent B2/B3.
    - Youssef Chraibi : residentsDB id:6 **apt V1 (villa), +31 NL** ; mais `residentsData` D:1296 = **apt D1, +212**. Incohérent.
    - Omar El Fassi : residentsDB id:3 apt A3 **status 'late' mais paye:300** (donc partiel, pas 'late') ; residentsData D:1297 apt A3.
    - `residentsData` (3 entrées) et `residentsDB` (10) et `signalements`/`paiementsDB` = structures parallèles divergentes.
  - Note : `syndicData.type='immeuble'` par défaut alors que residentsDB contient des villas.
- **Mode mixte** : `vocabResident(r,key)` D:2539 gère le mixte par type du résident ; `countUnites` D:2551 et `kpiUnitesLabel` D:2557 gèrent le mixte. **Mais `vocab()` (D:1279) ne gère PAS mixte.** Support mixte partiel/incohérent selon la fonction.
- **`relanceMessages`** D:2566-2591 : seulement **fr/en/nl/ar**. **Pas es/de.** Résident es/de → fallback (à vérifier usage).
- **`langueLabel`** D:2593 : seulement fr/en/nl/ar. Un résident langue es/de → `langueLabel[r.langue]` = undefined.
- `htmlGerantResidents`/`filterResidents`/`searchResidents` D:2595-2712 : recherche/filtre client-side sur data-search.
- `filterResidents('demandes')` réutilise la liste résidents pour afficher signalements (updSig, openWaSignal).
- `openFicheResident`/`renderFicheResident` D:2714+ : fiche modale, docs partagés vs internes (getDocsResident, viewDoc, deleteDocResident).
- **Bug date-dépendant** : historique paiements fiche D:2788-2799 utilise `new Date().getMonth()` (mois réel) mais tableau `mois` = jan..jun (6 éléments) D:2789. Au 2026-08-10, getMonth()=7 → `mois[6]`/`mois[7]` = **undefined** ; la boucle `for i=debut..moisNum` affiche des mois undefined. Comportement dépend de la date d'exécution. (cf date figée point 8, ici c'est l'inverse : dépend de l'horloge réelle.)

## DEMO 2800-3159 (fiche suite, dossier complet, édition, pays/langues)

- `renderFicheResident` : docs partagés vs internes, historique 3 mois, bouton `openDossierComplet`, `toggleEditResident`, `supprimerResident`.
- `supprimerResident` D:2842 : `confirm()` puis `residentsDB.splice`. Suppression en mémoire uniquement.
- `openDossierComplet`/`htmlDossierComplet` D:2856-2980 : dossier complet (partages, internes, reçus via `recusDB.filter(residentId===id)`), historique 2026.
  - Historique D:2943-2971 : `new Date().getMonth()`, `mois` = 6 mois jan-jun. Ici `if(i>moisNum)return ''` masque les mois futurs, mais si moisNum>5 (après juin) le mois courant (i===moisNum) n'est jamais atteint → `statutCourant` jamais rendu. Incohérence date-dépendante (moins grave que fiche).
- **`langues`** D:3034-3047 : 12 langues (fr/ar/en/nl/es/de + it/pt/tr/ru/zh/ja) — pour datalist uniquement.
- **`loadCountries()`** D:3052-3075 : **appel réseau externe** `fetch('https://restcountries.com/v3.1/all?fields=name,flag,translations')` avec fallback (liste 18 pays) si échec. Dépendance externe live dans la démo.
- `filterDatalist`/`selectOption` D:3077-3133 : autocomplétion nationalité (via API) / langue (liste fixe).
- `saveResident` D:3137 : mute residentsDB en place (nom/email/tel/nat/montant/langue).
- `openRelanceResident` D:3156 : relance individuelle (suite à lire).

## DEMO 3159-3538 (relance, horloge, dashboard, appartements, paiements, dépenses)

- **`openRelanceResident`** D:3156-3186 : `relanceMessages[r.langue] || fr` (D:3164) → un résident es/de reçoit un message **en français** (pas de message es/de). De plus D:3167-3168 fait `langueLabel[r.langue].split(...)` : pour langue es/de, `langueLabel[r.langue]` = undefined → **exception** (latent : aucun résident es/de dans les données par défaut, mais possible via ajout/édition).
- `frais = r.retard >= 10` D:3161 : frais de retard déclenchés à 10 jours (le libellé marketing dit "20 MAD après X jours").
- `startMoroccoClock` D:3190 : horloge live temps réel, timeZone Africa/Casablanca.
- **`htmlGerantDashboard`** D:3208 :
  - `encaisse` = somme `montant` des `status==='paid'` ; `total` = somme de tous ; `taux = encaisse/total`. **Les paiements partiels (`paye`) ne sont PAS comptés dans encaisse** (seul le statut 'paid' complet compte).
  - **`soldeInitial = 24850` codé en dur** D:3217 ("trésorerie reportée") ; `enCaisse = 24850 + encaisse - depensesMois` = la "trésorerie disponible" affichée. Nombre magique.
  - Bandeau relance intelligente via `detecterRelancesNecessaires()` D:3223 (moteur anti-harcèlement) + `lancerRelancesIntelligentes()`.
  - Contrats triés par `joursAvantEcheance(ctr.echeance)` D:3308 (fonction à trouver — cf point 8 date figée).
  - Réf. `depensesDB, paiementsDB, contratsDB, relancesHistorique, recusDB` (définis ailleurs).
- **`htmlGerantAppartements`** D:3336 : **INCOHÉRENCE MAJEURE** — les KPI en tête utilisent `residentsDB`, mais **la liste des appartements D:3354-3362 est un tableau CODÉ EN DUR de 8 lignes** qui **contredit residentsDB** :
  - D1 "Chraibi Youssef" (residentsDB : Chraibi = V1 villa) ; E2 "Ziani Mohammed" (residentsDB : V2) ; F1 "Moussaoui Amine" (residentsDB : V3). Les villas sont ré-étiquetées en appartements et **tous à "650 MAD"** alors que les villas paient 1200.
  - "Affichage 8/${residentsDB.length}" (=8/10). L'écran Appartements est donc une **maquette statique**, contrairement à l'écran Résidents qui est piloté par les données. `filterApts`/`searchApts` agissent sur ces lignes figées.
- **`htmlGerantPaiements`** D:3379 : KPI + impayés pilotés par residentsDB ; `manquant` = somme montant des `status==='late'` seulement (D:3382), alors que la liste impayés inclut aussi 'partial' (D:3384) → le reste des partiels n'entre pas dans `manquant`. Paiements récents via `paiementsDB.slice(0,6)`. `fmtPaymentDate(p)` (à trouver).
- **`htmlGerantDepenses`** D:3439 : `depensesDB` groupé par catégorie ; `catColors` catégories fixes D:3449-3454 ; photos factures affichées en `<img src="${d.photo}">` (base64). `deleteDepense` (mute depensesDB), `openDossierCategorie`/`htmlDossierCategorie`.

## DEMO 3538-3917 (dossier cat, actualités, signalements, paramètres, votes)

- **`htmlGerantActualites`** D:3565 : `actualitesManuelles` (dynamiques) **+ 5 actus CODÉES EN DUR** D:3574-3577 (Panne ascenseur, Travaux peinture, AG 2026, Nettoyage). Ces entrées statiques s'affichent toujours, avec "${residentsDB.length} résidents notifiés". Contenu figé mélangé au dynamique.
- `htmlGerantSignalements` D:3584 : recherche + filtre par statut (exclut résolus → archives), regroupé par urgence (urgente/importante/normale). `openArchivesSignalements`/`htmlArchivesSignalements`/`restaurerSignal` (rouvre) D:3663-3721. `filterSignalements` D:3724 re-rend toute la page puis refocus l'input (hack).
- **`htmlGerantParametres`** D:3732 :
  - Sélecteur type résidence immeuble/villa/mixte → `setResidenceType` D:3741-3743.
  - `editRow` charges conditionnelles selon type (villa→chargesVilla, mixte→les deux, sinon chargesMontant) D:3749-3754. Édition inline via `startEdit`/`saveEdit` (mute syndicData).
  - **Abonnements codés en dur** Starter 199 / Pro 499 / Entreprise devis D:3763-3766 → `changerPlan`.
  - Toggles automatisations (autoRelance/autoFrais/autoSMS/autoRapport/msgMute) → `toggleAuto`/`toggleMsgMute`. Libellés "Message après 3 jours", "+20 MAD après 10 jours".
  - Déconnexion → `logout()`.
- **`setResidenceType(type)`** D:3852 : bascule `depensesCategories` = villa / immeuble / union(mixte). **Confirme que les catégories de dépenses s'adaptent au type.** N'altère PAS residentsDB ni la liste appts figée.
- `changerPlan` D:3839 : entreprise → toast contact ; sinon change plan/abonnement.
- `renderResidentPage` D:3878 switch (accueil/paiements/messages/votes/actualites/signalements/depenses/documents/profil).
- **`htmlVotes(role)`** D:3898 : **PAYWALL** si `plan==='starter'` (écran verrouillé, `upgradeToPro`) ; sinon liste des votes. Confirme votes réservés Pro/Entreprise.

## DEMO 3917-4296 (votes suite, messagerie, accueil résident)

- Votes : `votesDB`, `voterPour` D:3976 (un vote par `_residentId`), `cloturerVote` D:3987 (calcule gagnant, publie une actualité résultat), `creerVote` D:4020 (ajoute vote + actualité auto), `upgradeToPro` D:4057 (passe plan à pro). Dates via `new Date()` réel, ids via `Date.now()`.
- Messagerie : `htmlGerantMessages` D:4064 (liste convs + chat), `searchMsgResidents`/`openConvWith`, `htmlResidentMessages` D:4170, `msgBubble`, `sendMessage` D:4204. **Tout en mémoire** (`conversations`). Résident = `_residentId` (2, Sara) fixe.
- `htmlResidentAccueil` D:4232 : hero selon statut ; **widget transparence collective** D:4250-4272 (compte payés/impayés depuis residentsDB, pression sociale sans nommer — conforme au brief) ; derniers paiements = mois courant dynamique **+ Mai/Avril CODÉS EN DUR "650 MAD"** D:4290-4291 (figé, faux pour résident villa 1200).

## DEMO 4296-4695 (pages résident : paiements, actus, signalements, budget, docs, profil)

- `htmlResidentAccueil` actualités récentes : `actualitesManuelles.slice(0,3)` **+ actus fixes de complément** D:4310-4313 (Panne ascenseur, Travaux, AG).
- `htmlResidentPaiements` D:4325 : mois courant dynamique + `paiementsDB.filter(apt===r.apt)` + **3 lignes CODÉES EN DUR** Mai/Avril/Mars "650 MAD · Reçu #2026-05/04/03" D:4390-4392 (numéros de reçu fabriqués, montant figé).
- `htmlResidentActualites` D:4396 : `actualitesManuelles` + **5 actus CODÉES EN DUR** D:4405-4409.
- `htmlResidentSignalements` D:4413 : `mesSignalements`.
- **`htmlResidentDepenses`** D:4445 : catégories/factures dynamiques depuis depensesDB, **MAIS KPI "24 850" (solde) et "82%" (taux) CODÉS EN DUR** D:4474-4476 (incohérent avec le vrai taux calculé côté gérant).
- **`htmlResidentDocuments`** D:4494 : reçus (recusDB) + docs privés/partagés dynamiques **+ 5 tuiles docs CODÉES EN DUR** (PV AG 2024, Budget 2026, Facture ascenseur, Contrat assurance, Règlement copro) D:4541-4545.
- Upload docs : `uploadDocResident` (FileReader base64 D:4560-4588), `gerantUpload`, `showDocChoice`/`confirmDocChoice` (partage/privé), `viewDoc`, `deleteDocResident`, `renommerDoc`/`confirmRename`. Structure `documentsPartages` (en mémoire).
- **`htmlResidentProfil`** D:4677 : **entièrement CODÉ EN DUR** — "Sara Tahiri", "Appartement B3 · 3ème étage" (encore B3, contredit residentsDB B2), "+33 6 12 34 56 78", "650 MAD". Ne lit pas _residentData.
- **Thème récurrent** : de nombreux écrans mélangent données dynamiques et contenu maquette figé ; incohérence apt B2/B3 de Sara partout.

## DEMO 4695-5094 (profil stats, sheets, reçus, paiements, dépenses/contrats, données)

- `htmlResidentProfil` stats **codées en dur** D:4702-4705 ("3 250 MAD", "11/12", "1 retard", score "4.6/5").
- `openSheet(id)` D:4715 : mixte→sélecteur type ; peuple `dep-cat` depuis `depensesCategories` ; peuple `especes-resident` depuis residentsDB ; sheet 'pay' remplit montant depuis `_residentData` (dynamique).
- `recusDB = []` D:4766 (vide au départ). `documentsPartages` seed (1 doc pour résident 2) D:4770.
- **`genererRecu`** D:4779 : `num = 'REC-'+year+'-'+_recuCounter`, **`_recuCounter=1000`** D:4777 incrémenté en mémoire. **Confirme point 9** : numérotation par compteur mémoire, réinitialisé au rechargement, non scopé résidence. unshift dans recusDB.
- **`confirmPay()`** D:4797 : **AUCUN paiement réel** — les champs carte (numéro/CVV/exp/nom) sont **totalement ignorés** ; met juste à jour residentsDB (paye=montant, status paid), génère reçu, unshift paiementsDB, écran succès. Le "tunnel Stripe" ne fait rien. **Succès affiché sans aucune validation.**
- `closeSuccess` D:4948 : force le hero à "650" MAD en dur D:4957 (faux si villa 1200).
- **`paiementsDB`** D:4966-4972 : 5 paiements **codés en dur**, tous **650** (dont Ziani "E2" et Moussaoui "F1" — apt DIFFÉRENTS de residentsDB V2/V3, et villas payées 650 au lieu de 1200). **Structure parallèle divergente (point 14).** Sara (apt B2) absente → ne voit que des lignes figées.
- `fmtPaymentDate` D:4975 : libellés dateKey localisés, **figés sur juin**.
- `enregistrerEspeces` D:5004 : paiement espèces, met à jour paye/status (partial/paid), génère reçu si complet. En mémoire.
- **Catégories dépenses adaptatives** : `depensesCategoriesImmeuble` (nettoyage, électricité, eau, maintenance, ascenseur, assurance, travaux, autre) D:5054 vs `depensesCategoriesVilla` (piscine, jardins, gardiennage, éclairage public, voirie, arrosage, déchets, maintenance, assurance, autre) D:5058. **Confirme l'adaptation réelle des catégories au type.**
- `actusDepenses` D:5067 (2 entrées — usage à confirmer). `actualitesManuelles = []` D:5073.
- **`contratsDB`** D:5076-5081 : 4 contrats, échéances 2026-07-05 / 06-20 / 06-28 / 09-15.
- **`joursAvantEcheance(dateStr)`** D:5085-5089 : **`const today = new Date('2026-06-10')` CODÉE EN DUR.** **Confirme point 8** (présent AUSSI dans la démo). Le compte à rebours est figé au 10 juin 2026 ; au 2026-08-10 réel, les contrats de juin/juillet apparaissent encore "à venir".
- `depensesDB` : référencé partout mais **non encore vu défini** ; définition attendue plus loin.

## DEMO 5094-5493 (contrats, bilan, votesDB, depensesDB, dépenses/actus/photos, ajout résident)

- `ajouterContrat`/`supprimerContrat` D:5091-5112 : mute contratsDB.
- `genererBilanAnnuel`/`htmlBilan` D:5115-5190 : bilan AG depuis residentsDB/depensesDB/contratsDB ; `solde = 24850 + encaisse - totalDep` (nombre magique répété) ; **date "10 juin 2026" codée en dur** D:5155. `imprimerBilan` via iframe srcdoc.
- `votesDB` D:5211-5228 : 2 votes seed (Réfection toiture, Changement nettoyage). `_voteCounter=100`.
- **`depensesDB` DÉFINI** D:5231-5237 : 5 dépenses (catégories immeuble), photo:null, numRecu DEP-2026-0001..0005. Défini APRÈS de nombreuses fonctions qui l'utilisent (ordre désordonné mais fonctionnel : appels au runtime).
- `addDepense` D:5239 : numRecu = 'DEP-'+year+'-'+`_depRecuCounter` (départ 5000) ; photo base64 ; unshift. Compteur mémoire.
- `downloadDepRecu`/`publierActu` D:5278-5325.
- **BUG élément fantôme** : `previewPhoto` D:5346-5357 et `removePhoto` D:5359-5365 font `document.getElementById('upload-zone').style.display=...` — **`upload-zone` n'existe PAS** dans le HTML (la sheet signalement a `sig-upload-buttons` D:924, pas `upload-zone`). → `getElementById` retourne null → **TypeError** sur `.style`. L'aperçu photo s'affiche quand même (lignes précédentes exécutées) mais une exception est levée ensuite. Cible DOM fantôme.
- `selectNewType` D:5368 (pré-remplit charges selon type villa 1200 / appt 650), `selectNewStatus`, `filterDatalistNew`/`selectNewOption`, `addNewResident` D:5440 (push residentsDB, id Date.now(), type selon syndicData.type/mixte→_newType). `selectUrgence`.
- Listener global fermeture dropdowns D:5476.

## DEMO 5493-5943 (signalements, relances, WhatsApp, FAB msg, modales, fin)

- **`submitSignalement`** D:5496 : ajoute à **`mesSignalements`** (liste résident) uniquement, **PAS à `signalements`** (liste gérant). → **Un signalement créé côté résident n'apparaît jamais côté gérant.** Les deux listes sont déconnectées. Rupture de flux (dans la démo mono-navigateur ça passe inaperçu, mais la logique est cassée).
- `openWaSignal`/`sendWA` D:5519-5539 : `sendWA` ne fait qu'un toast (aucun envoi réel).
- `openRelance(name)` D:5542 : retrouve le résident par **match partiel de nom** (fragile), fallback résident fictif.
- `openRelanceAll` D:5582 ; `simulateResidentPay` D:5616 (bascule en vue résident) ; `sendRelance` D:5625 → `ouvrirWhatsApp`.
- **Moteur relances anti-harcèlement** : `relancesHistorique={}` + `detecterRelancesNecessaires()` D:5656 : filtre late/partial, retard≥3j, exclut ceux relancés il y a <4j. Utilise `new Date()` réel (non figé). **Confirme la règle anti-harcèlement du brief.** `marquerRelance`, `lancerRelancesIntelligentes`, `ouvrirProchaineRelanceIntelligente` (séquentiel via confirm()).
- **`ouvrirWhatsApp(tel,message)`** D:5741 : construit une URL `https://wa.me/<numero>?text=...` et `window.open`. **Mécanisme réel de relance = deep link wa.me** (pas d'API WhatsApp Business). Normalise 0→212.
- `updSig` D:5750 (gérant met à jour signalements). `searchApts`/`filterApts` (sur lignes figées). `toggleNotif`, `showToast`, `updateMsgFab`, `toggleMsgMute`, `showMsgPopup`, `simulateResidentMessage` (messages démo aléatoires).
- Handler clavier Enter/Escape D:5879.
- **PAS de DOMContentLoaded / init auto** dans la démo : la landing est visible par défaut (CSS), currentLang='fr' fixe. L'app démarre au clic (doLogin sans auth).
- Queue de HTML final D:5887-5942 : msgPopup, input `gerant-doc-input`, msgFabWrap, recuModal, docChoiceModal, renameModal.

### Confirmations / codes morts démo
- `pageTitles` (D:2432) jamais référencé ailleurs → **code mort** (navTo utilise un objet `titles` local).
- `actusDepenses` (D:5067) défini, jamais rendu → probablement mort (à confirmer par recherche).
- `residentsData` (D:1294) 3 entrées : semble supplanté par `residentsDB` ; usage à confirmer.
- FIN LECTURE DEMO : lignes 1-5943 lues (5944 = fin de fichier).

---
# CONNECTÉ

## CONNECTE 1-533 (head + Supabase + CSS)

- C:8 CDN `@supabase/supabase-js@2`.
- **C:11-12 SECRETS/CONFIG EN DUR** : `SUPABASE_URL='https://xlhjuzbkbyndqjanddht.supabase.co'`, `SUPABASE_KEY='sb_publishable_pHmfnuV5Imo4wVDj-88wEQ_9a8-ko5-'`. Clé "publishable" (= anon key nouvelle nomenclature) : normalement publique, MAIS toute la sécurité repose alors sur les RLS Supabase, **non vérifiables par lecture statique du client**. Les points 1-6 du brief suggèrent des SELECT anonymes autorisés → RLS probablement absentes/permissives (à confirmer).
- `initSupabase()` C:15-21 (`_sb` client), globals `_residenceId` C:23, `_userId` C:24.
- Script précoce toggleLangMenu/setLang C:29-51 : identique démo.
- CSS C:52-531 : **quasi identique à la démo** (mêmes classes/variables). **Différence** : le bloc `@media(max-width:700px)` C:522-531 **N'inclut PAS** `.mobile-nav`/`.m-item`/`#mobileMoreMenu` (présents en démo D:513-544). `.main` mobile = `20px 16px` (démo `20px 16px 90px`). → **La barre de navigation mobile a été retirée dans la version connectée** (à confirmer dans body/JS).
- RTL : mêmes règles `[dir="rtl"]` limitées à msg-popup/fab (C:497,509,510). RTL partiel identique.

## CONNECTE — structure vs démo (établie par `diff` + lecture)

- **Corps des sheets/modales C:897-1246 = identiques à la démo** (tunnel carte Stripe conservé C:942-967 avec "650 MAD"/"Appartement B3" en dur ; especes/signal/wa/relance/depense/apt/actu/contrat/vote/success/toast identiques).
- **i18n C:1352-1971 = IDENTIQUE à la démo** (fr blob pollué C:1407 ; en avec dump nl C:1511 ; **objet nl toujours amputé** — 0 occurrence de `s_messages` dans le bloc nl 1569-1668, confirmé ; de complet C:1871). Mêmes conclusions i18n que la démo.
- `t()` C:1973, `_setLangFull` C:1993.
- **Différences d'état initial (C:1285-1320)** : `signalements=[]`, `mesSignalements=[]`, `conversations={}` (vides, chargés depuis DB) ; `syndicData` par défaut **VIDE/neuf** : residenceNom 'Ma résidence', gerantNom '', **plan 'starter'**, nbUnites 0, autoSMS/autoRapport false (démo : Al Firdaous/pro/10). 
- `residentsData` (dead code) **toujours présent** C:1338-1342.
- Sous-titres i18n gardent "Résidence Al Firdaous · Casablanca · Juin 2026" en dur (C:1409, C:1428) — restes de la démo dans la version connectée.
- Le diff (211 hunks) montre : connecte = démo + écrans auth (C:536-615) + couche persistance Supabase **ajoutée en bloc** (après la ligne démo 5885 → connecte ajoute 5996-6728) + appels DB async insérés dans les fonctions de rendu/mutation. Les régions identiques sont couvertes par équivalence (diff) ; les régions modifiées et le bloc DB/auth sont lus intégralement ci-dessous.

## CONNECTE 5940-6299 (couche données Supabase, bloc 1)

- `simulateResidentMessage` **désactivé** C:5968 (return ; démo renommée `_simulateResidentMessageDemo`).
- **`initData()` C:6002** :
  - `sb.auth.getUser()` → `userId = user?.id`, `_userId=userId` C:6008-6010.
  - `let query = sb.from('residences').select('*'); if (userId) query = query.eq('user_id', userId); {data} = await query.limit(1)` C:6013-6015. **CONFIRME POINT 5** : le filtre `user_id` n'est appliqué **que si userId défini**. Non authentifié → sélectionne **une résidence arbitraire** (limit 1) qui devient `_residenceId`, et l'app écrit dedans.
  - Si aucune résidence : **auto-création** d'une résidence C:6033-6046 avec les valeurs de `syndicData`. **Nuance point 7** : en connecté, `syndicData` par défaut = neutre ('Ma résidence', vide), **pas** les données de démo Al Firdaous. À confronter (point 7 dit "données de démonstration") — sous réserve d'un seed avant initData (à vérifier dans le flux auth).
  - Loaders C:6050-6060 : chaque chargeur dans try/catch individuel (bon), mais **échec silencieux** (console.warn seulement).
- **`chargerResidents()` C:6076** : `select('*').eq('residence_id',_residenceId)`, mappe **`codeAcces: r.code_acces`** C:6098 et compteCree. **CONFIRME POINT 2** : charge tous les résidents de la résidence, code_acces inclus, dans residentsDB (lisible par quiconque a ce contexte — à corréler avec initDataResident).
- `updateResidentDB` C:6153 : ne met à jour que si `typeof id === 'string'` (UUID) — les résidents de démo (id numérique) ne sont pas persistés.
- **Photos en base64** : `depenses.photo` (C:6173/6183), `documents.data` (C:6207/6220). **CONFIRME POINT 11** (base64 en colonnes Postgres, aucun Supabase Storage).
- **Schéma reconstitué (colonnes prouvées par les requêtes)** :
  - `residences` : id, nom, adresse, type, nb_unites, charges_montant, charges_villa, gerant_nom, gerant_email, plan, user_id, created_at.
  - `residents` : id (uuid), residence_id, user_id, apt, type, nom, email, tel, nationalite, langue, status, retard, montant, paye, code_acces, compte_cree, auth_id, created_at.
  - `paiements` : id, residence_id, user_id, nom, apt, montant, mode, date_str, created_at.
  - `depenses` : id, residence_id, user_id, cat, description, montant, date_str, photo(base64), num_recu, created_at.
  - `documents` : id, residence_id, user_id, resident_id, nom, type, data(base64), from_who, scope, date_str, created_at.
  - `recus` : id, residence_id, user_id, resident_id, num, nom, apt, montant, mode, mois, date_str, created_at.
  - `votes` : id, residence_id, user_id, titre, description, date_limite, options(json), voters(json), statut, created_at.
  - (signalements, actualites, contrats, relances : voir plus bas.)
- Tous les inserts incluent `residence_id` + `user_id` ; tous les `select` filtrent par `residence_id`.

## CONNECTE 6299-6728 (bloc données 2 + auth syndic + auth résident)

- DB signalements/actualites/contrats : mêmes patterns. Schéma complété :
  - `signalements` : id, residence_id, user_id, apt, resident, cat, loc, description, urgence, status, photo(base64), date_str, date_resolu.
  - `actualites` : id, residence_id, user_id, emoji, titre, message, pill_class, pill_txt, is_vote, vote_id, date_str.
  - `contrats` : id, residence_id, user_id, nom, fournisseur, emoji, montant, echeance, frequence.
  - `relances` : residence_id + created_at (+ voir 5757) — colonnes à confirmer.
- **`checkAuth()` C:6418** : `getSession()` → si session, initData ; sinon afficherEcranAuth. **MAIS** le handler `window load` C:6726 n'appelle QUE `initSupabase()` — **checkAuth n'est pas appelé au chargement** (usage à confirmer par recherche). Donc pas de restauration de session automatique évidente.
- **`loginSyndic()` C:6433** : vrai `sb.auth.signInWithPassword`. Succès → app gérant + `initData()`. Auth syndic réelle.
- `logoutSyndic` C:6472 : signOut + reload.
- **`prefillEmailFromCode()` C:6528** : au blur du champ code (onglet inscription, **avant toute auth**) → `sb.from('residents').select('email,compte_cree').eq('code_acces', code).maybeSingle()`. **CONFIRME POINT 1 (1re partie)** : SELECT anonyme sur `residents` par code_acces, renvoie l'email → nécessite une policy SELECT anonyme, permet énumération + fuite d'email.
- **`inscrireResident()` C:6572** :
  - C:6594 `sb.from('residents').select('*').eq('code_acces', code).maybeSingle()` — **AVANT auth**, `select('*')` → expose **toutes** les colonnes du résident (nom, email, tel, montant, retard, auth_id, etc.) à qui devine/possède un code. **CONFIRME POINT 1** pleinement.
  - Vérifie `compte_cree` pour empêcher réutilisation (bon). signUp + signInWithPassword immédiat (⇒ **email-confirm probablement désactivé** côté Supabase, sinon le signIn juste après échouerait) + update residents (compte_cree/auth_id/email).
- **`loginResident()` C:6634** : signInWithPassword, puis `select('*').eq('auth_id', user.id)` ; **si rien → repli `select('*').eq('email', email)` puis écrit `auth_id`** C:6652-6659. **CONFIRME POINT 3** : quiconque crée un compte Supabase avec l'email d'un résident (plausible si email-confirm off, cf. ci-dessus) revendique le dossier de ce résident (rattachement auth_id). Sécurité dépend des réglages Supabase (non visibles).
- **`entrerEspaceResident` C:6675** : place _residentId/_residenceId/_residentData depuis le résident, `initDataResident()`.
- **`initDataResident()` C:6696** : appelle **`chargerResidents()`** (→ charge TOUS les résidents de la résidence, code_acces inclus — **CONFIRME POINT 2 en contexte résident**), actualites, documents, votes. Puis re-cible _residentData ; **si la DB ne renvoie rien (RLS), garde `sauvegarde` locale et la pousse dans residentsDB** C:6710-6715. **CONFIRME POINT 6** : conserve les données locales en cas d'échec, masquant les blocages RLS (l'UI affiche un succès même si la DB a tout refusé).
- `window load` C:6726 : `initSupabase()` seulement.
- **POINT 4 (genererCodePour) et POINT 9/10 (reçus, try/catch) : à lire dans les régions modifiées (5456-5560, confirmPay/especes, genererRecu).**

## CONNECTE — findings des mutations / rendu (lecture ciblée guidée par diff)

- **checkAuth C:6418 = code MORT** (jamais appelé ; window load C:6726 = initSupabase seul) → **pas de restauration de session** ; un syndic déjà authentifié doit repasser par role screen → showLogin('gerant') → afficherEcranAuth (mais signInWithPassword ré-authentifie). Note UX.
- **doLogin C:2337 / loginWrap = code MORT** : showLogin route gérant→afficherEcranAuth, resident→afficherEcranResident (return avant le fallback loginWrap). L'ancien écran démo n'est jamais montré.
- **Point 10 CONFIRMÉ** : 65 `await` / 8 `try` / 8 `catch`. Peu de gestion d'erreur ; la plupart des appels DB gèrent l'erreur par `console.error` + `return` (échec silencieux côté UI).
- **genererCodePour C:5526** `code = apt.toUpperCase().replace(/\s/g,'') + Math.floor(1000+random*9000)` ; **addNewResident C:5478 idem**. **CONFIRME POINT 4** : préfixe = **numéro d'appartement** (deviná­ble), 4 chiffres (10 000 combinaisons), aucune unicité vérifiée, aucun rate-limit. (Nuance : le préfixe est le n° d'appt, pas la chaîne littérale "apt".)
- `partagerCodeAcces` C:5511 : partage le code via wa.me ou presse-papier.
- **genererRecu C:4824** : `_recuCounter=1000` mémoire, `num='REC-'+year+'-'+counter`, `saveRecuToDB` insert. **CONFIRME POINT 9** : compteur non re-synchronisé depuis la DB au chargement → après rechargement il repart à 1000 → **collisions de numéros de reçu garanties** entre sessions/syndics ; aucune contrainte d'unicité (num = simple colonne texte).
- **confirmPay C:4843 (carte)** : **NE persiste NI le paiement NI le statut** (pas de savePaiementToDB, pas de updateResidentDB) — seul le reçu est inséré (genererRecu). Champs carte ignorés (Stripe décoratif). → **incohérence** : après rechargement, le paiement carte est perdu mais un reçu orphelin subsiste. **Erreur silencieuse / perte de données.**
- **enregistrerEspeces C:5044 (espèces)** : persiste correctement (savePaiementToDB + updateResidentDB). Asymétrie carte vs espèces.
- **joursAvantEcheance C:5114** `new Date('2026-06-10')` — **CONFIRME POINT 8** identique en connecté.
- **soldeInitial = 0** C:3250 (fixé ; démo avait 24850 en dur).
- **submitSignalement C:5560** persiste dans `signalements` (table) → **corrige la déconnexion résident→gérant de la démo.**
- **openRelanceResident C:3189** : ajoute `|| '🇫🇷 Français'` sur langueLabel → **corrige le crash latent es/de de la démo.**
- **Écrans rendus data-driven en connecté (corrections vs démo)** : Appartements C:3388 (residentsDB.map, montant réel, état vide), Profil résident C:4720 (dynamique + stats depuis paiementsDB), Paiements résident C:4430 (mois courant + paiementsDB, plus de lignes Mai/Avril/Mars figées), Actualités C:4451 (dynamique + état vide), notifList C:2372 ("Aucune notification"). **La version connectée a nettoyé la plupart des maquettes figées de la démo.**
- **Persistance quasi complète** : deleteDepenseDB(3538), updateSignalementDB(3751,5863), updateVoteDB(4035,4045), saveVoteToDB(4095), saveActualiteToDB(4068,4112,5334), saveContratToDB(5134), deleteContratDB(5143), saveDepenseToDB(5283), saveSignalementToDB(5583), updateResidentDB(5078), saveResidentEditsDB(3171). **Seule exception notable : confirmPay (carte).**
- `startMsgSimulation` toujours appelé (buildGerant C:2389) mais `simulateResidentMessage` désactivé (no-op) → timer mort toutes les 25s.
- **résidents `residentsDB=[]`** C:2538 (chargé DB) ; `_residentId=2` défaut démo C:2405 (écrasé par entrerEspaceResident au vrai login).
- **`pageTitles` C:2448 = code mort** (bug template ${} conservé), navTo utilise `titles` local (sous-titres dynamiques depuis syndicData — amélioration).
- `residentsData` (dead) et `mock-*` landing "24 850/82%" C:689-691 (landing marketing figée, normal).

FIN LECTURE. Couverture détaillée dans 00-couverture.md.
