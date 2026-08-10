# 02 — Inventaire fonctionnel

Convention : `D:` = index-demo.html, `C:` = index-connecte.html. Sauf mention contraire, un écran
existe dans les deux versions à des lignes proches (structure quasi identique). Les numéros donnés
renvoient à la version où j'ai lu le bloc.

## A. Écrans hors-application (communs)

| Écran | Rôle | Lignes | Fonction | Données lues/écrites |
|---|---|---|---|---|
| Landing marketing | public | D:550-735 / C:617-802 | présentation, tarifs, CTA | statique ; tarifs 199/499/devis **en dur** (D:683/692/700) |
| Sélecteur de langue | public+app | D:560-571, 789-801 | `setLang()` 6 langues | `currentLang` |
| Écran sélection rôle | public | D:738-758 / C:805-825 | `showLogin('gerant'|'resident')` | `currentRole` |
| Login démo (loginWrap) | public | D:761-777 / C:828-844 | `doLogin()` | **démo : aucune auth** ; **connecté : écran MORT** (showLogin route ailleurs, C:2304-2320) |
| **authScreen (syndic)** | connecté seul | C:537-556 | `loginSyndic()` email+mdp Supabase | `supabase.auth.signInWithPassword` |
| **authResident (login+inscription)** | connecté seul | C:559-614 | `loginResident()`, `inscrireResident()`, `prefillEmailFromCode()`, `switchResidentTab()`, `checkPasswordMatch()` | table `residents` (code_acces, email, compte_cree, auth_id) |
| Écran succès paiement | app | D:1174-1182 / C:1238-1246 | `downloadLastRecu()`, `closeSuccess()` | `_lastRecu` |
| Panneau notifications | app | D:828-831 / C:891-895 | `toggleNotif()` | démo : notifs **en dur** (D:2319-2323) ; connecté : "Aucune notification" (C:2372) |

## B. Espace GÉRANT — écrans (rendus dans `#pageContainer` via `renderGerantPage`, D:2509 / C:2522)

1. **Tableau de bord** (`htmlGerantDashboard` D:3208 / C:3241)
   - Bandeau relance intelligente (si `detecterRelancesNecessaires()` > 0).
   - Carte « Trésorerie disponible » : `enCaisse = soldeInitial + encaissé − dépensesMois`. **soldeInitial = 24850 en dur (D:3217)** ; **= 0 en connecté (C:3250)**.
   - KPI : impayés, taux collecte, nb unités (`kpiUnitesLabel`), retard moyen.
   - Collecte du mois (barre), liste impayés à relancer (`openRelance`), derniers paiements (`paiementsDB`).
   - Contrats & échéances (tri par `joursAvantEcheance`), bouton bilan annuel.
   - Lit : residentsDB, depensesDB, paiementsDB, contratsDB, relancesHistorique. Écrit : rien directement.

2. **Résidents** (`htmlGerantResidents` D:2595 / C:2597)
   - Recherche, 4 KPI cliquables (total/à jour/retard/demandes), liste résidents.
   - `filterResidents('all'|'paid'|'late'|'demandes')` ; `searchResidents`.
   - Fiche : `openFicheResident` → `renderFicheResident` (infos, historique paiements, docs partagés, dossier interne, **code d'accès** C:2819-2847, éditer, supprimer).
   - Lit/écrit : residentsDB, documentsPartages, (connecté : tables residents/documents).

3. **Appartements** (`htmlGerantAppartements` D:3336 / C:3358)
   - **DÉMO : liste CODÉE EN DUR de 8 lignes (D:3354-3362)** contredisant residentsDB.
   - **CONNECTÉ : liste data-driven depuis residentsDB (C:3389), montants réels, état vide.**
   - `filterApts`, `searchApts`.

4. **Paiements** (`htmlGerantPaiements` D:3379 / C:~3413)
   - KPI encaissé/manquant/taux/unités, liste impayés (relance + espèces), derniers paiements.
   - Bouton « Enregistrer un paiement » → sheet espèces.

5. **Messages** (`htmlGerantMessages` D:4064 / C:~4131)
   - Liste conversations + chat ; recherche résident (`searchMsgResidents`, `openConvWith`).
   - **Entièrement en mémoire (`conversations`), aucune table Supabase** (voir 06).

6. **Dépenses / Budget** (`htmlGerantDepenses` D:3439)
   - Total (hero), par catégorie (barres), toutes les factures (photo base64), justificatif (`downloadDepRecu`), suppression.
   - `openDossierCategorie` (dossier d'une catégorie).

7. **Actualités** (`htmlGerantActualites` D:3565)
   - `actualitesManuelles` + **DÉMO : 5 actus en dur (D:3574-3577)**. Publier → sheet.

8. **Signalements** (`htmlGerantSignalements` D:3584)
   - Recherche/filtre par statut, groupé par urgence, archives (`openArchivesSignalements`), rouvrir.
   - Actions : `updSig` (prendre en charge / résolu), `openWaSignal` (WhatsApp).

9. **Votes** (`htmlVotes('gerant')` D:3898)
   - **Paywall si plan starter** (D:3900) → `upgradeToPro`. Sinon liste + créer/clôturer.

10. **Réglages** (`htmlGerantParametres` D:3732)
    - Type résidence (immeuble/villa/mixte → `setResidenceType`), champs éditables (`editRow`/`startEdit`/`saveEdit`), abonnements **199/499/devis en dur** (D:3763-3766, `changerPlan`), automatisations (toggles), déconnexion.

11. **Dossier complet résident** (`openDossierComplet`/`htmlDossierComplet` D:2856) — page dédiée.
12. **Bilan annuel AG** (`genererBilanAnnuel`/`htmlBilan` D:5115) — page imprimable ; date « 10 juin 2026 » en dur (D:5155).
13. **Dossier catégorie de dépenses** (`htmlDossierCategorie` D:3531).
14. **Archives signalements** (`htmlArchivesSignalements` D:3680).

## C. Espace RÉSIDENT — écrans (`renderResidentPage` D:3878 / C:~?)

1. **Accueil** (`htmlResidentAccueil` D:4232) : hero statut, **widget transparence collective** (payés/impayés, pression sociale sans nommer — D:4250-4272), derniers paiements, actus récentes.
2. **Paiements** (`htmlResidentPaiements` D:4325 / C:4375) : hero + historique. **DÉMO : lignes Mai/Avril/Mars en dur (D:4390-4392)** ; **CONNECTÉ : dynamiques + état vide (C:4430-4439)**.
3. **Messages** (`htmlResidentMessages` D:4170) : chat avec le syndic (en mémoire).
4. **Budget** (`htmlResidentDepenses` D:4445) : KPI (**DÉMO : 24850/82% en dur D:4474-4476**), catégories, factures.
5. **Signalements** (`htmlResidentSignalements` D:4413) : `mesSignalements`, nouveau signalement.
6. **Documents** (`htmlResidentDocuments` D:4494) : reçus, privés/partagés, **DÉMO : 5 docs en dur (D:4541-4545)** ; upload + choix partager/privé.
7. **Actualités** (`htmlResidentActualites` D:4396) : `actualitesManuelles` + **DÉMO : 5 actus en dur**.
8. **Votes** (`htmlVotes('resident')`) : voter, résultats.
9. **Profil** (`htmlResidentProfil` D:4677) : **DÉMO : entièrement en dur (Sara Tahiri, B3)** ; **CONNECTÉ : dynamique (C:4720) + stats**.

## D. Fenêtres modales (sheets) — statiques dans le HTML

| id | Rôle | Champs | Action |
|---|---|---|---|
| sheet-especes | gérant | résident, montant, date, note | `enregistrerEspeces` |
| sheet-pay | résident | **carte/exp/CVV/nom** (tunnel « Stripe ») | `confirmPay` (ne fait rien de réel) |
| sheet-signal | résident | loc, catégorie, description, photo, urgence | `submitSignalement` |
| sheet-wa | gérant | message éditable | `sendWA` (toast seulement) |
| sheet-relance | gérant | destinataires, aperçu éditable | `sendRelance` → WhatsApp |
| sheet-ajouter-depense | gérant | photo, catégorie, desc, montant, date | `addDepense` |
| sheet-ajouter-apt | gérant | prénom/nom/email/tel/nat/langue/type/n°/montant/statut | `addNewResident` |
| sheet-nouvelle-actu | gérant | type, titre, message | `publierActu` |
| sheet-nouveau-contrat | gérant | nom/fournisseur/montant/échéance | `ajouterContrat` |
| sheet-nouveau-vote | gérant | titre/desc/date | `creerVote` |
| sheet-fiche-resident (dynamique) | gérant | — | fiche + édition |
| recuModal / docChoiceModal / renameModal | — | — | reçu / choix doc / renommer |

## E. Confrontation à la description (Partie 1)

### Décrit et présent
- Tableau de bord trésorerie/collecte/impayés/retard : **présent**.
- Liste unités + résidents, statut, montant dû, jours de retard : **présent** (résidents ; appartements = maquette en démo, réel en connecté).
- Fiche résident + dossier complet + docs partagés/internes : **présent**.
- Paiement espèces + reçu numéroté : **présent**.
- Dépenses avec photo facture + catégories : **présent** (photo en base64).
- Contrats fournisseurs + compte à rebours : **présent** (mais date figée, cf 05).
- Relances WhatsApp individuelles/groupées + aperçu éditable : **présent** (via wa.me).
- Moteur de détection des relances + règle anti-harcèlement : **présent** (`detecterRelancesNecessaires`, exclusion <4j).
- Actualités typées : **présent**.
- Signalements + suivi : **présent** (déconnecté résident→gérant en démo, corrigé en connecté).
- Votes à distance : **présent** (paywall Pro).
- Bilan annuel AG : **présent**.
- Réglages résidence + abonnement : **présent**.
- Génération d'un code d'accès résident : **présent** (connecté ; `genererCodePour`, `partagerCodeAcces`).
- Espace résident (accueil, indicateur collectif, historique, budget consultable, signalement, actus, docs avec choix partage, inscription par code) : **présent**.
- Mode immeuble/villa/mixte (vocabulaire + catégories dépenses) : **présent** (partiellement, cf 03).
- Multilingue 6 langues + langue préférée par résident : **présent** (inégal, cf 03/04).

### Décrit mais absent / partiel
- **Paiement en ligne réel** : le tunnel carte « Stripe » **ne fait rien** (`confirmPay` ignore la carte). Aucune intégration Stripe réelle. (Cohérent avec le point non-tranché n°3.)
- **Écriture RTL pour l'arabe** : partielle (démo pose `body.style.direction`, connecté = à vérifier ; l'attribut `dir` jamais posé — cf 03/04, point 12).
- **Distinction propriétaire / locataire** : **totalement absente** (rôle unique « résident »).
- **Tantièmes / quote-part** : absents.

### Présent sans être mentionné
- **Horloge live de Casablanca** sur le dashboard (`startMoroccoClock`, D:3190).
- **Simulation de messages entrants** (démo, D:2345) ; désactivée en connecté (C:5968).
- **Autocomplétion nationalité via API externe RestCountries** (`loadCountries`, fetch réseau, D:3052 / C:3071).
- **12 langues dans le datalist** (`langues`, D:3034) alors que l'UI n'en gère que 6.
- **Frais de retard automatiques** annoncés (20 MAD) : `frais = retard>=10` n'agit que sur le texte du message de relance, aucun montant n'est réellement ajouté aux charges.
