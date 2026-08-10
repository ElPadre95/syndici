# 06 — Différences démo → connectée

Établi par `diff index-demo.html index-connecte.html` (211 hunks) + lecture des régions modifiées.
La version connectée **part de la démo** et lui greffe une persistance Supabase + une authentification,
tout en nettoyant plusieurs maquettes figées.

## 1. Ajouté

### Infrastructure
- **Client Supabase** : CDN (C:8), config `SUPABASE_URL`/`SUPABASE_KEY` en dur (C:11-12), `initSupabase` (C:15), globals `_residenceId`/`_userId` (C:23-24).
- **Écrans d'authentification** : `authScreen` (syndic, email+mdp, C:537) et `authResident` (connexion + inscription par code, C:559).
- **Couche de données** (~730 lignes, C:5996-6410) : pour chaque entité, `chargerX`/`saveXToDB`/`updateX`/`deleteX` sur 11 tables (residences, residents, paiements, depenses, documents, recus, votes, signalements, actualites, contrats, relances).
- **Auth** : `loginSyndic`, `logoutSyndic`, `checkAuth` (mort), `loginResident`, `inscrireResident`, `prefillEmailFromCode`, `switchResidentTab`, `checkPasswordMatch`, `entrerEspaceResident`, `initDataResident`, `initData` (C:6412-6728).
- **Génération/partage de code d'accès** : `genererCodePour` (C:5526), `partagerCodeAcces` (C:5511), section code dans la fiche résident (C:2819-2847).
- **Persistance des mutations** : quasi toutes les actions (ajout/suppression/mise à jour résident, dépense, contrat, vote, signalement, actualité, paiement espèces, réglages, relance) appellent leur fonction DB.

### Corrections de fond vs démo
- **Écran Appartements** : maquette figée (D:3354-3362) → **data-driven** depuis residentsDB (C:3389), montants réels, état vide.
- **Profil résident** : entièrement en dur (Sara/B3, D:4677) → **dynamique** depuis `_residentData` + stats calculées (C:4720).
- **Paiements résident** : lignes Mai/Avril/Mars en dur (D:4390-4392) → mois courant + `paiementsDB` réels + état vide (C:4430-4439).
- **Actualités / notifications** : entrées en dur (D:3574-3577, 2319-2323) → dynamiques + « Aucune actualité/notification ».
- **Signalement résident→gérant** : reconnecté (C:5583 persiste dans `signalements`).
- **Trésorerie initiale** : `24850` → `0` (C:3250).
- **Crash latent es/de** dans `openRelanceResident` : corrigé par `||'🇫🇷 Français'` (C:3200).
- **Historique de paiements** : généré depuis l'horloge (bug M9) → tiré de `paiementsDB` (C:2791, 2977).
- État initial `syndicData` neutre (« Ma résidence », plan `starter`, nbUnites 0) au lieu des données Al Firdaous/pro.

## 2. Supprimé / désactivé
- **Barre de navigation mobile** et menu « Plus » : CSS (D:513-544) et éléments (`#mobileNav` D:805, `#mobileMoreMenu`, `toggleMobileMore`) **retirés** en connecté. → **régression d'ergonomie mobile** pour une cible qui paie « en 3 min depuis son téléphone ».
- **Simulation de messages entrants** : `simulateResidentMessage` réduit à `return` (C:5968) ; l'ancienne version conservée morte (`_simulateResidentMessageDemo`).
- Données de démonstration en dur (residentsDB/paiementsDB/depensesDB/contratsDB/votesDB) : vidées (`[]`), chargées depuis la base.

## 3. Comportement modifié
- **Connexion** : « aucune auth » (démo `doLogin`) → vraie auth Supabase (syndic) et auth + inscription par code (résident). L'ancien `loginWrap`/`doLogin` subsiste mais **mort**.
- **Mutations** : de « en mémoire seulement » → « en mémoire + persistance DB » (sauf `confirmPay` carte, cf C8/05).
- **Relances** : historique désormais persisté dans la table `relances` et rechargé (C:5757/5767) — la règle anti-harcèlement survit au rechargement.

## 4. Ce que la version connectée a perdu au passage
1. **Navigation mobile** (barre du bas + menu « Plus ») — régression nette pour l'usage smartphone.
2. **Cohérence perçue en cas de refus RLS** : `initDataResident` masque les échecs (C6) → en dev, on ne voit pas que la sécurité bloque ; risque de livrer avec des RLS fausses.
3. Rien d'autre de fonctionnel : la connectée est un sur-ensemble propre de la démo côté fonctionnalités.

## 5. Sens de l'évolution
La démo est une **maquette cliquable** (tout en dur, tout en mémoire, zéro sécurité). La connectée est
une **première tentative de produit réel** : elle branche une vraie base, une vraie auth, un vrai parcours
d'inscription par code, et nettoie les faux contenus. C'est un progrès cohérent et non trivial.

MAIS le saut s'est fait **sans revoir le modèle de sécurité** (logique 100 % client, RLS supposées
permissives, secrets d'accès faibles) ni le **modèle métier** (toujours un rôle « résident » unique,
aucune quote-part). La connectée reste une démo « avec base de données » plutôt qu'un produit sûr :
les défauts qui comptent (C1-C9) sont ceux introduits ou laissés par ce branchement rapide.
