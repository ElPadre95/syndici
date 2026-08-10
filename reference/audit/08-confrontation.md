# 08 — Confrontation au premier audit

Note d'honnêteté : la liste des 15 constats figurait dans l'énoncé initial ; je l'ai donc vue avant de
lire le code. J'ai néanmoins mené ma lecture intégrale et indépendante, et je reprends ici chaque point
avec **mes** numéros de ligne, en signalant surtout les nuances et infirmations.

Statut : ✅ confirmé · ⚠️ confirmé avec nuance · ❌ infirmé · ❓ non vérifiable par lecture statique.

---

**1. SELECT anonyme sur `residents` avant auth (prefillEmailFromCode, inscrireResident)**
✅/❓ **Confirmé dans le code, exploitabilité sous réserve RLS.** `prefillEmailFromCode` C:6535 (`select('email,compte_cree').eq('code_acces',code)`) et `inscrireResident` C:6594 (`select('*').eq('code_acces',code)`) s'exécutent sans session. `select('*')` expose bien nom/email/tel/montant/retard/auth_id/code_acces. La fuite effective **dépend d'une policy SELECT anonyme** (non visible ici) — si elle existe, le constat tient ; sinon ces appels échouent et l'inscription est cassée. Point juste sur l'intention du code.

**2. `chargerResidents` select('*') + mapping `code_acces`, lisible par un résident**
✅ **Confirmé.** C:6079 `select('*').eq('residence_id',_residenceId)`, mapping `codeAcces:r.code_acces` C:6098. Appelé côté résident par `initDataResident` C:6701 → un résident charge tous ses voisins (sous réserve RLS). Exact.

**3. `loginResident` : repli sur email puis écriture `auth_id`**
✅ **Confirmé.** C:6652-6659 : `select('*').eq('auth_id',...)` → si vide, `eq('email',email)` puis `update({auth_id})`. Combiné au `signUp`+`signInWithPassword` immédiat de l'inscription (email-confirm vraisemblablement désactivé), permet de revendiquer un dossier par email connu. Exact (dépend des réglages Supabase).

**4. `genererCodePour` : `apt` + 4 chiffres, préfixe prévisible, sans limite**
⚠️ **Confirmé, avec précision.** C:5529 (et `addNewResident` C:5478) : `apt.toUpperCase().replace(/\s/g,'') + Math.floor(1000+Math.random()*9000)`. Le préfixe est **le numéro d'appartement** (ex. « B3 »), pas la chaîne littérale « apt » — mais l'esprit du constat (préfixe devinable + 4 chiffres, `Math.random`, aucune unicité, aucun rate-limit) est exact.

**5. `initData` : `.eq('user_id',userId)` conditionnel, sinon `.limit(1)` arbitraire**
✅ **Confirmé.** C:6013-6015 : `if(userId) query=query.eq('user_id',userId)` ; sans userId, `.limit(1)` prend une résidence quelconque et l'app écrit dedans. Exact.

**6. `initDataResident` conserve les données locales en cas d'échec et les pousse dans `residentsDB`**
✅ **Confirmé.** C:6699 (`sauvegarde=_residentData`), C:6710-6715 : si la DB ne renvoie rien, garde `sauvegarde` et `residentsDB.push(sauvegarde)`. Masque les blocages RLS. Exact.

**7. Auto-création d'une résidence avec les données de démonstration à la première connexion**
❌/⚠️ **Partiellement infirmé.** L'auto-création existe bien (`initData` C:6031-6046, insert `residences`). MAIS elle utilise `syndicData` qui, en version connectée, est **neutre/vierge** : `residenceNom:'Ma résidence'`, `gerantNom:''`, `plan:'starter'`, `nbUnites:0` (C:1303-1320). **Ce ne sont donc PAS les données de démonstration** (Al Firdaous/Casablanca/pro/10 unités) qui sont insérées — celles-ci n'existent qu'en version démo (D:1259). Le constat « avec les données de démonstration » est **inexact pour la version connectée** : la résidence créée est vide. (Restes de démo présents ailleurs : sous-titres i18n « Al Firdaous » C:1409, mais pas dans l'insert.)

**8. `joursAvantEcheance` contient `new Date('2026-06-10')`**
✅ **Confirmé.** C:5114 (et démo D:5085) : `const today = new Date('2026-06-10')`. Compte à rebours figé. Exact dans les deux versions.

**9. Numérotation des reçus par compteur mémoire, réinitialisé au rechargement, insert sans scoping**
✅ **Confirmé, aggravé.** `_recuCounter=1000` C:4822, `num='REC-'+année+'-'+counter` C:4828, `saveRecuToDB` insert sans contrainte C:4839. Précision : le compteur **n'est jamais re-synchronisé** sur le max en base au chargement (`chargerRecus` C:6242 ne touche pas `_recuCounter`) → **collisions garanties** après rechargement, pas seulement possibles. Même schéma pour `_depRecuCounter=5000`. Exact.

**10. Environ 8 blocs try/catch pour 65 await**
✅ **Confirmé au chiffre près.** Décompte : 65 `await`, 8 `try`, 8 `catch`. Exact.

**11. Photos de factures en base64 dans des colonnes Postgres, aucun Supabase Storage**
✅ **Confirmé, étendu.** `depenses.photo` C:6173/6183, `documents.data` C:6207/6220, `signalements.photo` C:6319/6332 — toutes en base64. Aucun appel à Supabase Storage dans le fichier. Exact (concerne factures **et** documents **et** photos de signalement).

**12. L'attribut `dir` n'est jamais posé ; l'arabe s'affiche de gauche à droite**
⚠️ **Confirmé pour l'attribut, nuancé pour l'effet.** L'attribut `dir` n'est **jamais** posé (aucun `setAttribute('dir')`, aucun `dir=` sur `<html>`/`<body>` ; `<html lang="fr">` reste figé). En revanche `_setLangFull` pose `document.body.style.direction='rtl'` pour l'arabe — **C:2013** (connecté) **et D:1969** (démo). Conséquence réelle : le **flux de texte passe bien en RTL**, mais (a) les règles CSS `[dir="rtl"]` (repositionnement msg-popup/fab, C:497/509/510) **ne s'appliquent pas** faute d'attribut `dir`, et (b) le **layout global reste LTR** (sidebar `left:0`, `margin-left`, marges). Donc l'arabe n'est pas « affiché de gauche à droite » au sens strict : c'est un **RTL partiel** (texte inversé, mise en page non inversée). Le constat est vrai sur l'attribut manquant et le rendu imparfait, mais imprécis sur « s'affiche de gauche à droite ».

**13. Traductions très inégales, le néerlandais le plus incomplet**
✅ **Confirmé, quantifié.** Clés uniques par langue (approx., léger bruit dû aux `:` dans les valeurs) : fr ~405, ar ~399, en ~383, es ~352, de ~352, **nl ~209**. Le nl omet tout le bloc applicatif (msg/vote/doc/sig/dep/recu/voc/ctr/bilan/abo/fin/hist/mois), collé par erreur dans l'objet `en` (mort). Exact, nl est de loin le plus incomplet.

**14. Trois structures parallèles divergentes : residentsDB, residentsData, paiementsDB**
⚠️ **Confirmé, avec correction importante.** Les divergences existent (Sara B2 dans `residentsDB` D:2527 vs B3 dans `residentsData` D:1339 et le tunnel de paiement ; Chraibi V1 villa vs D1 ; `paiementsDB` avec apt E2/F1 pour des villas). **MAIS `residentsData` est du CODE MORT** : défini D:1294/C:1338, **jamais lu** (0 lecture, vérifié). Les structures parallèles réellement *actives* en démo sont plutôt `residentsDB` (canonique), la **liste d'appartements codée en dur** (D:3354, 8 lignes) et `paiementsDB` (apt divergents). En connecté, `residentsDB`/`paiementsDB` sont vidées et chargées de la base ; `residentsData` reste présent et mort. Le constat pointe une vraie incohérence mais nomme une structure inutilisée.

**15. Aucune notion de propriétaire distinct du locataire, ni de tantièmes/quote-part**
✅ **Confirmé.** Rôle unique « résident » partout (`residents`, `_residentData`, un seul jeu de droits) ; aucune colonne propriétaire/locataire/tantième/quote-part dans le schéma reconstitué (03). C'est le point structurant du verdict (07 §4.4). Exact.

---

## Synthèse
- **Confirmés sans réserve** : 2, 3, 5, 6, 8, 9, 10, 11, 13, 15.
- **Confirmés avec nuance** : 1 (sous réserve RLS), 4 (préfixe = n° d'appt), 12 (RTL partiel, pas LTR total), 14 (`residentsData` est mort).
- **Partiellement infirmé** : 7 (auto-création réelle, mais avec des données **vierges**, pas les données de démonstration, en version connectée).
- **Non vérifiable par lecture statique** : la portée réelle des points 1-6 dépend des policies RLS Supabase (à tester sur le projet).

Aucun point n'est entièrement faux ; le seul réellement inexact est le **n°7** (les données insérées sont neutres, pas démo), et les n°4/12/14 méritent les précisions ci-dessus.
