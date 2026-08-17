# PROGRESS — Suivi des incréments

Méthode : un incrément à la fois. Après chacun → commit, capture d'écran, case cochée, **stop** et
attente de validation. Reflète l'état réel à tout moment.

**Serveur de dev** : http://localhost:3000/fr (laissé tournant toute la session, rechargement à chaud).
**Base de dev** : PostgreSQL local sur `127.0.0.1:55432` (migré + seed : 1 résidence, 24 lots, 29 personnes).
**Compte de dev** (`npm run dev:account`) : `syndic@dev.local` / `dev-syndic-2026` — syndic (OWNER_ADMIN)
de l'organisation qui détient le mandat actif sur la résidence du seed. Jamais en production.
**Routes protégées** : toute route de gestion exige une session (middleware) ; redirection vers
`/<locale>/sign-in?callbackUrl=…` puis retour après connexion.

## Tranche A — écrans métier du syndic

- [x] **A1** — Coquille de l'application connectée : navigation latérale, en-tête, page d'accueil.
      Design provisoire mais réel : la navigation fonctionne, la session est lue, la langue se change.
- [x] **A2** — Créer une résidence (nom, adresse, ville, type, nb d'unités, charges, échéance).
      Crée l'organisation + le mandat si absent. La résidence apparaît dans une liste.
      Sélecteur de résidence active dans l'en-tête (persisté en cookie). Routes gardées + compte de dev.
- [x] **A3** — Créer les lots : un par un et en série depuis le nombre d'unités
      (référence, type, étage, surface, quote-part, charges si ≠ défaut).
      Génération avec schéma choisi (continu / par étage) + aperçu avant création, idempotente.
      Modification, archivage (jamais de suppression si historique), total des quotes-parts + alerte 1000.
      Tests d'isolation du cookie de résidence active (cookie = entrée non fiable).
- [x] **A4** — Liste des lots (écran principal du syndic) : référence, occupant (propriétaire + pays si
      à l'étranger, locataire + délégation, ou occupé/vacant), deux états dérivés (règlement × temporalité),
      montant + sous-note ; indicateurs, recherche, filtres à compteurs justes ; lignes → fiche du lot.
      Quote-part répartie à la génération (total 1000). Étanchéité propriétaire testée. Tableau en 6 requêtes.
- [x] **A5** — Ajouter une personne à un lot (via person-access), dédoublonnage MRE (recherche +
      rattachement d'une personne existante), délégation des charges au locataire, fin de rattachement
      (date de fin, jamais de suppression), chronologie des occupants (actifs vs terminés). Mode
      d'occupation explicite du lot (occupé/loué/vacant). Chevauchement refusé avec message clair.
      Seed varié (4 états + lot vacant en dur).
- [x] **A6** — Émettre une invitation sur une personne rattachée (impossible sans rattachement actif :
      bouton désactivé + explication, jamais d'échec après clic). Affiche le code UNE fois (lisible,
      groupé, avec échéance, copiable) + lien `wa.me` pré-rempli dans la langue préférée de la personne
      (nom, lot, résidence, code, adresse d'activation). Suivi sur la fiche du lot ET vue d'ensemble
      `/invitations` (qui, quand, état : en attente / activée / révoquée / expirée) ; révocation d'une
      invitation en attente puis réémission. La vérification du code n'expose AUCUNE donnée personnelle
      avant activation. Correctifs préalables : création personne + rattachement dans UNE transaction
      (plus d'orphelin), champs du formulaire préservés à l'erreur. Bout-en-bout vérifié : émission →
      activation en session non authentifiée → création du compte → lien compte↔personne (usage unique,
      irréversible). Le périmètre du résident est borné par la matrice `can` (un locataire n'atteint ni
      dépenses ni identité du propriétaire) ; l'espace résident dédié reste hors tranche A.
- [x] **A7** — Import Excel/CSV de lots + occupants. Modèle téléchargeable (fr/ar) avec en-têtes +
      ligne d'exemple. Lecture tolérante : .xlsx et .csv, ordre des colonnes libre, en-têtes insensibles
      à la casse/accents/langue, montants « 650 » / « 650,00 » / « 1 200,00 », cellules et ligne vides
      ignorées. Seule la référence est obligatoire. **Aperçu avant validation** (rien n'est écrit avant
      confirmation) : ligne par ligne, à créer / déjà présent / rejeté AVEC motif clair (doublon,
      référence existante, locataire sans propriétaire, montant illisible, quote-part invalide, e-mail
      mal formé, type inconnu). **Écriture en UNE transaction** (tout ou rien) : lots + personnes +
      rattachements ensemble ; dédoublonnage MRE (A5) ; idempotence (réimport = 0 doublon) ; quote-part
      répartie sur 1000 si la colonne est absente (A3). Rapport final (lots créés, personnes créées,
      rattachements, lignes ignorées). Réservé au staff (`can(role, 'lot.manage')`).
      **Limite : 500 lignes / 2 Mo** (transaction unique confortable ; au-delà, découper le fichier —
      l'optimisation du verrouillage de masse est repoussée à une tranche ultérieure).
      Vérifié au navigateur avec un vrai fichier réaliste (`fixtures/import-lots-test.xlsx`, 60 lignes,
      accents + arabe + téléphones hétérogènes + 7 lignes défectueuses) importé sur une résidence vide ;
      capture arabe (RTL) incluse.

## Tranche B — la boucle métier (finance)

- [x] **B1** — Appels de charges. Génération d'une campagne pour une période (an, mois) sur la résidence
      active : un appel par lot non archivé, montant = charge du lot (sinon défaut résidence par type),
      échéance = jour d'échéance de la résidence. Le REDEVABLE est DÉRIVÉ du rattachement actif porteur
      des charges (propriétaire, ou locataire si délégation) — jamais figé sur l'appel. Idempotence par
      l'index unique `(lotId, période)` + `ON CONFLICT DO NOTHING` : relancer ne duplique rien, les lots
      déjà appelés sont signalés ; un lot vacant est appelé (le propriétaire reste redevable). Aperçu
      avant génération (total, à appeler / déjà appelés). Écran de suivi : une ligne par campagne
      (période, total appelé, encaissé, reste dû, taux de collecte). Toute génération tracée au journal
      d'audit. Réservé au staff (`charge.manage`, ajouté à la matrice). Cœur pur (`computeCampaignPlan`,
      `aggregateCampaigns`) + écriture executor-based (`writeCampaign`) testée PGlite ET Postgres réel.
      Vérifié au navigateur (génération d'octobre 2026 : 25 appels, redevable dérivé dont un locataire
      délégué, idempotence à la réémission) ; capture arabe (RTL) incluse.
- [x] **B2** — Encaissement. Enregistrer un paiement sur un appel de charges (montant, date, mode —
      espèces en PRIORITÉ au Maroc, chèque, virement ; JAMAIS carte —, référence, enregistré par).
      Formulaire pré-rempli sur le reste dû, en espèces, à aujourd'hui (3 gestes pour l'espèce).
      Partiels et paiements multiples s'additionnent naturellement ; le STATUT de l'appel reste DÉRIVÉ
      (jamais écrit) : « non réglé » → « partiel » → « soldé » se recalculent. Un paiement est IMMUABLE :
      l'annulation passe par une ÉCRITURE INVERSE (paiement négatif liant l'original + allocations
      négatives), avec un motif, tracée au journal d'audit ; le statut redevient donc « non réglé »/
      « partiel » par dérivation. Refus d'annuler une annulation ou un paiement déjà annulé. Toute
      écriture financière en centimes (helper `money`) et auditée. Cœur executor-based (`writePayment`,
      `reversePayment`) testé PGlite ET Postgres réel (6 invariants). Panneau « Charges & paiements » sur
      la fiche du lot (appels, encaisser, historique, annuler). Vérifié au navigateur (encaissement
      espèces → soldé, annulation → non réglé) ; capture arabe (RTL) incluse.
- [x] **B3** — Reçu. Chaque encaissement émet un reçu numéroté — `REC-<exercice>-<seq>`, séquence
      CONTINUE et SANS TROU par (résidence, exercice) — DANS la même transaction que le paiement
      (un rollback n'entame pas le compteur ; réémission par `writePayment`, tracée `receipt.issue`).
      L'exercice suit l'année d'encaissement. Le reçu est un INSTANTANÉ comptable (numéro + montant
      figés en base) : la réimpression rend TOUJOURS le même document (le paiement est immuable).
      Annuler un paiement VOIDE son reçu (bandeau « annulé ») tout en conservant son numéro — jamais
      réutilisé. Document imprimable fr/ar (propriétés logiques RTL), sobre et officiel (en-tête
      cabinet + résidence, payeur, lot, période(s) réglée(s), mode, montant, émission) ; le chrome
      de l'app est masqué à l'impression (`data-print-hide`). Le numéro du reçu est visible et
      cliquable dans l'historique des paiements du lot. Réservé au staff (`receipt.issue`). Émission
      et void testés PGlite ET Postgres réel. Vérifié au navigateur (reçu valide, reçu annulé,
      capture arabe RTL incluse).
- [x] **B4** — Compte du lot & vue globale des paiements. **Relevé de compte** du lot : grand livre
      chronologique DÉBIT (appels) / CRÉDIT (règlements) / re-débit (annulations) avec solde courant ;
      solde de clôture = total appelé − net réglé = reste dû. Rien n'est stocké — tout est DÉRIVÉ des
      appels et paiements immuables (cœur pur `buildLedger`, testé). Le numéro de reçu figure sur chaque
      règlement (barré si annulé). Imprimable fr/ar (en-tête cabinet + résidence, propriétaire), accessible
      depuis la fiche du lot ; réservé au staff (`lot.view.all`). **Vue globale des paiements** (`/paiements`,
      remplace le stub) : tous les règlements de la résidence, le plus récent d'abord, avec lot (cliquable),
      payeur, mode, reçu et montant ; les annulations en négatif ; total encaissé net en tête. Réservé au
      staff via un nouveau droit `payment.view.all` (matrice + test). Vérifié au navigateur (relevé fr, vue
      globale fr, capture arabe RTL du relevé incluse).

## Tranche C — Dépenses & transparence

- [x] **C0** — Stockage de fichiers réel. Couche d'abstraction `StorageDriver` (le fournisseur n'est
      jamais en dur) : driver **local** (dev, sans réseau, `.storage/` gitignoré) et driver **Vercel Blob**
      (prod), choisis par l'environnement ; chaque fichier porte son driver en préfixe de `storageKey`
      (`"<driver>:<ref>"`) pour une relecture toujours correcte. Un fichier est TOUJOURS scopé à une
      résidence (clé `residences/<id>/…`, segments assainis = pas de traversée) ; `findAccessibleFile`
      ne le renvoie que pour sa résidence — isolation inter-résidences testée (PGlite ET Postgres réel).
      Les octets ne sont JAMAIS servis par une URL de fournisseur : seule la route authentifiée
      `/api/files/[id]` les rend, derrière trois gardes — signature HMAC expirante (`AUTH_SECRET`),
      session, et appartenance à la résidence active. Types acceptés (images + PDF) et taille (≤ 10 Mo)
      validés avec refus propre. Le contenu ne touche jamais la base (contrainte SQL anti-base64 conservée).
      Choix de stockage à valider par le propriétaire du projet ; action Vercel requise (créer le Blob store).
- [x] **C1** — Saisir une dépense. Formulaire rapide (le gérant photographie une facture depuis son
      téléphone : input `capture`) — catégorie, montant en centimes, date, fournisseur, description,
      **justificatif** (image ou PDF, ≤ 10 Mo) stocké réellement via C0, et **visibilité** PARTAGE
      (copropriétaires) / INTERNE (syndic) qui pilote la transparence. Les catégories dépendent du type
      de résidence (§7.3) — données modifiables (`ExpenseCategory`), pas un enum. Le numéro de justificatif
      `DEP-<exercice>-<n>` est continu, alloué dans la transaction. Une dépense ne se supprime pas :
      **annulation par écriture inverse** (dépense négative liant l'originale, total net nul) — comme les
      paiements (contrainte alignée `<> 0`). Toute écriture est auditée (`expense.record`/`expense.reverse`).
      Liste staff avec justificatif consultable en un clic (URL signée), badge INTERNE, annulation. Cœur
      executor-based testé PGlite ET Postgres réel ; défauts §7.3 testés. Vérifié au navigateur (saisie,
      justificatif PDF servi en 200 via la route signée / 403 si altéré, annulation, capture arabe RTL).
- [x] **C2** — Liste & transparence. La liste des dépenses gagne des **filtres** (catégorie + période) et
      une **recherche fournisseur**, portés par l'URL (partageable, rechargeable). Une **répartition par
      catégorie** (la lecture « budget » du prototype) : chaque poste avec son montant NET et sa part du
      total, triée décroissante, barres de proportion (cœur pur `aggregateByCategory`, testé). Et surtout
      la **trésorerie réelle de la période — encaissé − dépensé** (sommes nettes, annulations comprises ;
      les dépenses INTERNE comptent, la trésorerie est un fait comptable) : affichée en tête de `/depenses`
      (recalculée selon la période) ET **sur le tableau de bord** (tout l'historique), à côté du taux de
      collecte. Vérifié au navigateur (trésorerie dashboard + période, filtre fournisseur/période, négatif
      en orange, répartition, capture arabe RTL).
- [x] **C3** — Contrats fournisseurs. Nom, fournisseur, montant (centimes), échéance, fréquence
      (mensuel→annuel). Le **compte à rebours** et l'**alerte visuelle** sont DÉRIVÉS de l'échéance vs la
      date RÉELLE du serveur (SPEC §7.2 ; le M1 « date figée » du prototype est corrigé) — jamais stockés.
      Paliers : **< 0 « Expiré » (rouge)**, **≤ 30 j (orange)**, **sinon (vert)** ; liste triée par échéance
      la plus proche/dépassée d'abord. Saisie et archivage (soft delete) réservés au staff, tracés à
      l'audit (`contract.record` / `contract.archive`) ; nouveau droit `contract.view`/`contract.manage`
      (matrice + test). Cœur pur `contractCountdown` testé (bornes 0 et 30), écritures testées PGlite ET
      Postgres réel. Écran `/contrats` (nav). Vérifié au navigateur (4 contrats seed : un expiré rouge,
      deux orange, un vert ; tri par urgence ; capture arabe RTL incluse).

## Tranche E — Relances & communication

- [x] **E1** — Détection & relance. Moteur §7.1 transcrit **à l'identique** du prototype
      (`evaluateDunning`, cœur pur testé) : statuts concernés, **seuil de retard**, et surtout la condition
      **anti-harcèlement** (on ne relance pas quelqu'un relancé il y a moins de N jours), tri par retard
      décroissant. Les seuils NE sont pas codés en dur : ils viennent de l'entité `ReminderRule`
      (configurable par résidence — `overdueThresholdDays`, `minDaysBetweenReminders`,
      `concernedSettlementStates`, `lateFeeThresholdDays`). Écran `/relances` : lot, redevable, montant dû,
      jours de retard, et l'historique (nombre de relances envoyées + date de la dernière) ; bandeau
      « N résidents à relancer · détection auto » sur l'écran ET sur le tableau de bord. Réservé au staff
      (`reminder.manage`). Seed : impayés à stades variés, certains relancés 1–2 fois, d'autres jamais, et
      **un cas relancé aujourd'hui que l'anti-harcèlement exclut** (prouve que le moteur protège).
      Vérifié au navigateur (12 à relancer, tri par retard, A6 exclu ; capture arabe RTL incluse).
- [x] **E2** — Envoi WhatsApp. Le canal est un **lien wa.me pré-rempli** (pas d'API Meta, pas de coût) :
      le message s'ouvre dans WhatsApp, le gérant appuie sur envoyer. Le message vit dans les **catalogues**
      (contenu, pas code) et part dans la **langue préférée du destinataire** — fr ou ar, indépendamment de
      la langue de l'interface — avec nom, lot, résidence, période(s), montant dû, jours de retard, et
      comment régler. **Aperçu éditable** avant envoi (ajustable au cas par cas). Relance **unitaire** et
      **groupée** (séquence des liens un par un, chaque envoi marqué). Chaque relance est **tracée** (à qui,
      quand, quelle règle, quel canal, **le texte envoyé** — via `Reminder.message`, migration) ; cette
      trace nourrit l'anti-harcèlement. ⚠ La trace reflète une **INTENTION** d'envoi, pas une certitude de
      réception — l'interface le dit explicitement (le gérant peut ouvrir le lien sans envoyer). Cœur pur
      (`waLink`/`waPhoneDigits`) + écriture testés PGlite ET Postgres réel. Vérifié au navigateur (aperçu
      éditable, message fr pour un MRE et **arabe pour un résident même en interface française**, trace en
      base, capture arabe RTL).
- [x] **E3** — Actualités. Le syndic publie vers les résidents : **type** (information, travaux, urgence,
      réunion), titre, corps, et **audience** — tous, propriétaires seulement, ou locataires seulement.
      Écran `/actualites` (nav) : formulaire de publication + liste (badges type & audience). La lecture
      côté résident est **prête au niveau des données** (`listAnnouncementsForResident`) et affichée dans
      l'**accueil sobre du résident invité** (`ResidentHome`) — l'audience est filtrée par un cœur pur
      `audiencesFor` (testé) : un propriétaire voit ALL+OWNERS, un locataire ALL+TENANTS ; l'un ne voit
      jamais les actus de l'autre (prouvé sur données réelles). Publication réservée au staff
      (`announcement.manage`) ; lecture ouverte (`announcement.view`). Seed : actualités de types et
      audiences variés, dont une réservée aux locataires. Vérifié au navigateur (publication → liste,
      filtrage propriétaire/locataire au niveau données, capture arabe RTL).

## Tranche F — combler les écrans vides

- [x] **F1** — Réglages. L'écran `/reglages` n'est plus un placeholder : le syndic édite **sa résidence**
      (nom, adresse, ville, type immeuble/villa/mixte, charges appartement & villa, jour d'échéance 1–28),
      règle les **seuils de relance** qui pilotent la détection §7.1 (**seuil de retard**, **délai
      anti-harcèlement**, statuts concernés — « je mets 5 jours au lieu de 3 » se fait ici, pas dans le
      code), et gère les **catégories de dépenses** (ajouter, renommer, désactiver/réactiver). Le plan
      d'abonnement (offre + nombre d'unités) est affiché, sans verrou de fonctionnalité. Validation **pure
      et testée** (`validateResidenceEdit`, `validateReminderRule`, `validateCategoryLabel` : montants en
      centimes, échéance bornée, au moins un statut, virgule/espace-milliers tolérés). Réservé au syndic
      (`residence.settings`) ; **toute modification est tracée au journal d'audit**. Vérifié au navigateur :
      seuil de retard 3→5 persisté + audité, catégorie créée/renommée/archivée persistée + auditée,
      capture arabe RTL de l'écran mirroré.

- [x] **F2** — Annuaire des résidents. L'écran `/residents` n'est plus un placeholder : « qui est
      Untel et comment le joindre. » Toutes les personnes rattachées à la résidence active — nom, rôle
      (propriétaire / locataire), **lot(s)**, pays de résidence, langue préférée, téléphone, et **état de
      compte** (jamais invité / invité en attente / compte activé). Recherche par nom (aussi pays & n° de
      lot), filtres par rôle et par état de compte. Chaque lot mène à sa fiche (`/lots/[id]`). **Cas MRE :
      une personne détenant plusieurs lots apparaît UNE fois, ses lots agrégés — jamais en doublon** (seed
      enrichi : Sara Tahiri détient A1 + A7 ; prouvé en base par `person-access.db.test.ts`). Actions
      rapides par ligne : lien WhatsApp pré-rempli dans la **langue du destinataire**, et **émission
      d'invitation** si la personne n'a pas de compte. Tout passe par la couche `person-access`
      (`listResidentDirectory`, seul module autorisé à lire `Person`) — le **test méta reste vert**. Staff
      uniquement (`resident.list`) ; invitation gardée par `invitation.manage` + rattachement actif.
      Dérivations pures testées (`residentAccountStatus`, `matchesResidentFilters`). Vérifié au navigateur :
      MRE dédoublé (A1+A7), recherche/filtres, invitation émise (PENDING en base), états NEVER/PENDING
      affichés, capture arabe RTL de l'écran mirroré.

- [x] **F3** — Documents. L'écran `/documents` n'est plus un placeholder. Dépôt (staff,
      `document.manage`) : **titre, type** (règlement, PV d'AG, assurance, attestation, autre) **et
      portée**. Le cahier des charges demandait « privé au déposant / partagé avec le syndic / visible de
      toute la résidence » : les deux premières existaient (`PRIVE`, `PARTAGE`), la troisième non — **ajout
      de la portée `RESIDENCE`** (migration `ALTER TYPE … ADD VALUE`, isolée comme l'ajout de CHEQUE) +
      **type de document** (`DocumentType`, migration). Le fichier passe par la **couche de stockage C0
      réutilisée** (`storeFile`, jamais refaite) ; consultation par la **route signée** `/api/files/[id]`
      (HMAC + session + scope résidence). Liste filtrable **par type et par portée**. Les documents
      `RESIDENCE` apparaissent chez le résident, dans son **accueil** (comme les actualités). **Étanchéité
      transcrite en cœur pur testé** (`documentVisibleTo`, 6 cas) : un `PRIVE` n'est visible que de son
      déposant (même pas du syndic), un `PARTAGE` n'est pas visible des autres résidents, un locataire ne
      voit jamais le `PRIVE` du propriétaire de son lot, `RESIDENCE` est visible de tous, `INTERNE` du
      staff seul. Seed enrichi : règlement + PV (RESIDENCE), contrat d'assurance (PARTAGE), attestation
      (PRIVE d'un résident) — **fichiers réellement stockés** (plus de `FileAsset` fantôme). Vérifié au
      navigateur : dépôt (formulaire types/portées), filtres, **route signée qui sert bien le PDF**
      (200, application/pdf), **le syndic ne voit PAS l'attestation privée du résident**, capture arabe RTL.

- [x] **F4** — Membres du cabinet. Un cabinet peut **déléguer à un gestionnaire**. Section dans les
      **Réglages** (naturel : déjà réservé au syndic) : liste des membres avec leur rôle et l'état de leur
      compte ; **invitation par e-mail** (prénom, nom, e-mail, rôle) — dédoublonnée par e-mail, réactive un
      accès retiré sans jamais créer de doublon (`upsert` sur `@@unique(org, personne)`) ; **retrait d'un
      accès = statut ENDED + date de fin** (`endedAt`, migration) — **jamais une suppression**, l'historique
      reste et s'affiche (« Accès retirés · date »). **Verrou dernier administrateur** transcrit en cœur pur
      testé (`isLastActiveAdmin`, 5 cas) : on ne peut ni retirer ni rétrograder le dernier `OWNER_ADMIN`
      actif — l'UI le protège (badge, pas de bouton) ET l'action le refuse. **Réservé au syndic**
      (`member.manage`) ; un **gestionnaire ne peut pas** gérer les membres (matrice vérifiée). Identités via
      la couche person-access (`listOrgMembers`, `findPersonIdByEmail`) — **test méta vert**. Toute
      modification tracée au journal d'audit (`member.invite` / `member.role.change` / `member.remove`).
      Vérifié au navigateur : liste (admin + gestionnaire), retrait (ENDED daté, en historique), réinvitation
      (réactivée sans doublon), dernier admin protégé, capture arabe RTL de la section mirroré.

## Refonte visuelle

- [x] **R1** — Le système, appliqué au tableau de bord (écran de référence). **Design uniquement** :
      aucune logique, aucun schéma, aucune route, aucune permission, aucun texte de contenu réécrit ;
      les **272 tests restent verts sans adaptation**. Système posé d'abord : **échelle typographique à
      rôles** (eyebrow, note, body, section, title, stat, display) ; **palette à rôles STRICTS** (indigo =
      action, vert = succès, ambre = alerte, rouge = danger, encre bleu-nuit pour l'identité — aucune
      couleur décorative) ; **espacement/densité** (cartes aérées, listes compactes) ; **bibliothèque
      `ui/`** (Button variantes+états, Field, Select, Table, Card, Badge, EmptyState, Alert, Spinner).
      Deux éléments de chrome : **sélecteur de langue en MENU compact** prêt pour 4 langues (fr, en, ar,
      nl — seuls fr/ar câblés ; ajouter en/nl est un travail d'i18n) et **bulle de messagerie** (FAB indigo + compteur + tiroir glissant, défini visuellement, non branché). **Nav responsive** : barre latérale
      fixe en grand écran, repliée en tiroir sur mobile (le sidebar ne mange plus l'écran). Tableau de bord
      **recomposé et enrichi** avec la hiérarchie du prototype : d'abord ce qui appelle une action (impayés,
      contrats qui expirent), puis **l'argent en bloc indigo dominant** (trésorerie disponible + encaissé/
      dépensé/solde du mois + raccourci « Encaisser »), puis la **collecte du mois** (taux + barre de
      progression + reste), puis **trois listes courtes** cliquables (derniers paiements, dernières
      dépenses, échéances de contrats). Toutes les données viennent des lectures B/C/E existantes,
      **4 lectures parallélisées** côté page (aucune agrégation nouvelle). Vérifié au navigateur : fr + ar
      (RTL intégralement mirroré : héros, barre de progression, tiroir, FAB), desktop + mobile. Gate
      complet vert. Deux manques signalés (non bricolés) : le détail soldés/partiels/en retard + retard
      moyen exigerait une agrégation nouvelle ; « Encaisser » pointe vers `/paiements` faute de route
      d'enregistrement autonome.

## Tranche G — Espace propriétaire

- [x] **G1** — La coquille et l'accueil. Navigation **propre au propriétaire** (peu d'entrées, pensée
      mobile), distincte du syndic : la barre latérale prend une **variante de rôle** (`staff` / `owner` /
      `tenant`) — ajouter le locataire plus tard sera une différenciation par les droits, pas une refonte.
      **Gating par le rôle** `PROPRIETAIRE` (jamais `isStaff` : un propriétaire est `isStaff=false`) ; un
      **locataire garde son accueil sobre** et n'atteint aucun écran propriétaire (mur d'étanchéité intact,
      `security.leak.test` + `permissions.test` verts). L'accueil répond à « où j'en suis » : **situation
      de paiement par lot** (montant dû + échéance, **bandeau rouge en retard** avec le nombre de jours),
      **indicateur collectif** de la résidence (**des NOMBRES seulement** — X à jour · Y en attente, jamais
      d'identité), **actualités et documents** visibles (réutilisation E3/F3). Un propriétaire **MRE
      multi-lots** bascule entre ses lots (sélecteur de lot) et, via l'en-tête, entre ses **résidences**
      (le sélecteur montre désormais aussi les résidences où l'on n'est que résident). Lectures
      **sûres pour un non-staff** (`src/server/finance/owner.ts`) : `getLotFinance` (vue syndic) LÈVE pour
      un propriétaire (il résout des noms via la couche staff) — ici on lit les appels de charges + statut
      dérivé **sans jamais toucher au modèle Person** et en **vérifiant la détention du lot** (un
      propriétaire ne voit jamais les charges d'un voisin). Cœurs purs testés (`summarizeCharges`,
      `countSettledLots`). Seed : le **propriétaire MRE de démo** (Sara, 2 lots) reçoit un **id STABLE** et
      un **compte de démonstration** (`proprietaire@syndici.ma`, même mot de passe que le syndic) ; en
      local, `npm run dev:owner` (`owner@dev.local`). Vérifié au navigateur connecté en propriétaire :
      situation A1 (en retard 650 MAD, 14 j) vs A7 (à jour), indicateur collectif, actualités, bascule de
      lot ; fr + ar (RTL intégral), desktop + mobile. Gate complet vert (279 PGlite, 95 Postgres réel).

- [x] **G2** — Mes charges, mes reçus, mon relevé. Écran `/proprietaire/charges` (nav propriétaire) :
      l'**historique des appels** de son lot avec **statut dérivé** (soldé / partiel / non réglé + retard),
      ses **paiements** avec le **numéro de reçu** et la **réimpression** du reçu existant, et l'accès à
      son **relevé de compte** (B4) présenté de SON point de vue (son nom depuis la session, jamais résolu
      par la couche staff). Un **MRE multi-lots** bascule entre ses lots (sélecteur par URL). Quand les
      charges sont **déléguées au locataire**, c'est dit clairement (il reste concerné même s'il ne paie
      pas). **Lectures sûres pour un non-staff** (`getOwnerLotPayments`, `getOwnerLotAccount`,
      `getOwnerReceipt`) : elles réutilisent le cœur pur `buildLedger` et les composants imprimables
      existants (`LotAccountDocument`, `ReceiptDocument`, `PrintButton`, réutilisés tels quels), **sans
      jamais toucher au modèle Person** et en **vérifiant la détention du lot** — un propriétaire n'ouvre
      jamais le relevé ni le reçu d'un voisin (le reçu d'un lot non détenu renvoie `null`). Accès réservé
      au rôle PROPRIETAIRE (`charge.view.own` / `payment.view.own`) ; aucune permission ajoutée (le reçu
      suit `payment.view.own`) → la matrice reste inchangée. Vérifié connecté en propriétaire : historique
      A1 (2 soldés, 1 en retard), paiements avec 3 reçus réimprimables + une annulation, réimpression d'un
      reçu, relevé B4 (solde de clôture 650 MAD, annulation re-débitée) ; fr + ar (RTL intégral). Gate
      complet vert (279 PGlite, 95 Postgres réel).

- [x] **G3** — La transparence (l'écran qu'on montre). `/proprietaire/transparence` : le propriétaire voit
      les **dépenses VISIBLES** de sa résidence (jamais l'**INTERNE**), leur **répartition par catégorie**
      (barres de proportion), et surtout les **justificatifs consultables** via la **route signée C0**
      (vérifié : le PDF est bien servi, 200/application/pdf) ; plus le **budget & trésorerie** (encaissé /
      dépensé / disponible, bloc indigo dominant) et les **contrats en cours** (avec échéances). Réutilise
      les lectures existantes **sûres pour un non-staff** (`getTreasury`, `listExpenses` avec
      `includeInternal: false`, `aggregateByCategory` pur, `listContracts`) — aucune ne touche au modèle
      Person. **Étanchéité** : `includeInternal: false` rend l'interne invisible, et on ne signe QUE les
      justificatifs des dépenses visibles (aucun lien vers un fichier interne). Réservé au rôle
      PROPRIETAIRE via **`expense.view`** — permission que le **locataire N'A PAS**, donc il n'atteint
      jamais cet écran (matrice inchangée). Vérifié connecté en propriétaire : budget/trésorerie, 6
      catégories, dépenses avec justificatif ouvrable, contrats ; fr + ar (RTL intégral — barres remplies
      depuis la droite). Gate complet vert (279 PGlite, 95 Postgres réel).

- [x] **G4a** — La messagerie (**le mur d'abord**). Un lot porte jusqu'à **DEUX fils distincts**,
      discriminés par `Conversation.counterpartyRole` (**OWNER / TENANT**, contrainte d'unicité
      `(residence, lot, rôle)`) : le propriétaire n'atteint QUE le fil OWNER de SON lot, le locataire QUE
      le fil TENANT du SIEN, le syndic voit **les deux**. Point de contrôle **unique** (`messaging/access.ts`,
      `canAccessConversation`) traversé par toutes les lectures, l'envoi et **le service des pièces jointes**
      (une pièce jointe de fil n'est jamais servie hors de son fil — garde ajoutée à `/api/files`, bucket
      « messages »). **Tests d'étanchéité écrits AVANT l'interface** (8, PGlite + Postgres réel) : locataire
      ⊥ fil propriétaire (contenu ET existence) et ⊥ sa pièce jointe ; propriétaire ⊥ fil locataire ;
      propriétaire ⊥ fil d'un autre lot ; syndic voit les deux fils de SA résidence, aucun d'une autre.
      Messagerie : fil, messages horodatés, **pièces jointes** via la couche de stockage existante (`storeFile`,
      lien signé C0), **compteur de non-lus**. Côté propriétaire : la **bulle flottante branchée** (pastille +
      panneau qui s'ouvre → liste des fils par lot → fil → composeur). Côté syndic : écran **`/messagerie`**
      (fils **groupés par lot** avec le **rôle de l'interlocuteur** visible). Le **locataire n'a pas encore
      d'espace**, mais son fil existe déjà dans le modèle (l'ajouter = une branche de droits). Modèle : migration
      `Conversation.counterpartyRole` + `Message.fileAssetId` (+ `Residence.onlinePaymentEnabled` pour G4b).
      Vérifié connecté : propriétaire (fil A1 avec pièce jointe PDF réellement servie 200, envoi d'un message),
      syndic (les deux fils A1·propriétaire + A4·locataire, non-lus) ; fr + ar (RTL intégral). Gate complet vert
      (287 PGlite, 103 Postgres réel).

- [x] **G4b** — Le **paiement en ligne SIMULÉ**. Abstraction **`PaymentProvider`**
      (`src/server/payments/provider.ts`) avec une seule implémentation, le **`MockProvider`** :
      `createCheckout` → `confirm`, **aucune vraie transaction, aucun fonds**. Un bouton **« Payer »**
      sur les charges du propriétaire, **uniquement quand il reste quelque chose à régler**, mène à un
      **tunnel** avec un **bandeau « simulation » permanent** à chaque étape, un récapitulatif et un bouton
      « Simuler le paiement » — **AUCUN champ de carte, aucune donnée bancaire demandée ni collectée**. À la
      confirmation, l'**action** (`simulatePaymentAction`) passe par **`writePayment`** (jamais un
      contournement) : paiement immuable en mode **`EN_LIGNE`** + allocation + **reçu numéroté par la
      séquence existante** (vérifié : `REC-2026-0025`, mode « Paiement en ligne », référence `SIMU-…`) + audit.
      **Réservée au PROPRIÉTAIRE du lot concerné** (permission **`payment.pay.own`**, jamais le staff — testé :
      `roles.filter(pay.own) === ['PROPRIETAIRE']`), qui **re-vérifie la détention du lot** (`getOwnerLotCharges`
      renvoie [] sinon). **Drapeau par résidence** `Residence.onlinePaymentEnabled`, **désactivé par défaut**,
      **activé sur la seule Al Firdaous** (seed). Le tunnel, quand l'appel est réglé, affiche une **confirmation
      avec lien vers le reçu** (jamais un rebond). **README de la couche paiement** : ce qu'un adaptateur réel
      devra fournir (checkout hébergé, webhook signé, idempotence) et la contrainte **NON NÉGOCIABLE — la
      plateforme ne détient JAMAIS les fonds** (règlement direct au syndic). Vérifié connecté en propriétaire :
      bouton « Payer » sur l'appel dû, tunnel, succès + reçu numéroté ouvrable ; fr + ar (RTL intégral). Gate
      complet vert (288 PGlite, 103 Postgres réel).

## Tranche H — Fonctions manquantes

- [x] **H1** — Les **incidents** (modèles `Incident`/`IncidentUpdate` jusque-là sans logique ni écran).
      **Côté propriétaire** : signaler (catégorie, description, localisation, **son lot ou une partie
      commune**, urgence, **photo**) et **suivre l'avancement**. **Côté syndic** : la **liste** de la
      résidence **triée par urgence puis ancienneté**, l'ouverture d'un incident, son **fil de suivi**
      horodaté (commentaires), le **changement de statut** (trace un STATUS_CHANGE) et l'**affectation à
      un fournisseur** (trace un CONTACT). **La boucle de transparence** (le point qui fait la valeur) :
      un incident se **relie à la dépense** qui en découle (`Expense.incidentId`, migration) ; le
      propriétaire voit alors **l'incident signalé, l'intervention et la facture** en un écran.
      **Étanchéité** — point de contrôle **unique** (`incidents/access.ts`, `canAccessIncident`) traversé
      par lectures, fil ET service de la **photo** : un propriétaire ne voit que **ses lots + les parties
      communes** de sa résidence, **jamais un autre lot** ni une autre résidence. **Tests d'étanchéité
      écrits AVANT l'interface** (5, PGlite + Postgres réel) : propriétaire voit son lot + partie commune,
      ⊥ un autre lot, ⊥ une autre résidence ; la photo suit le même accès ; le staff voit sa résidence,
      aucune autre. Le **fil est visible du déclarant** ; le modèle porte déjà `reportedByPersonId` +
      `lotId` nul (partie commune) pour qu'un **locataire** puisse signaler plus tard sans refonte.
      Chaque écriture significative **tracée au journal d'audit**. Seed : incidents à **stades variés**
      (NOUVEAU/EN_COURS/RESOLU, urgences variées) dont **un sur le lot du propriétaire de démo relié à une
      dépense visible avec facture**. Vérifié connecté : propriétaire (signalement, détail avec
      intervention + facture + fil), syndic (liste triée, gestion : statut/fournisseur/lien dépense) ;
      fr + ar (RTL intégral). Gate complet vert (293 PGlite, 108 Postgres réel).

- [x] **H2** — Les **frais de retard**. **Contrainte juridique (Maroc)** au cœur : un syndic n'applique de
      pénalités que si le règlement/AG l'a décidé — donc **configurable par résidence, DÉSACTIVÉ par défaut
      (`autoLateFee`), jamais activé automatiquement** (rappel juridique explicite dans les réglages). Règle
      paramétrable : **montant fixe + pourcentage** (points de base) **avec plafond optionnel**, appliquée
      **après N jours** de retard (seuil déjà porté par la règle de relance). **Génération IDEMPOTENTE** —
      unicité sur `chargeCallId` (au plus un frais par appel) + `skipDuplicates` : repasser le job ne double
      jamais les frais (garantie testée au niveau de la contrainte DB). Chaque frais **tracé au journal
      d'audit** avec la config qui l'a produit. Un frais est une **écriture au DÉBIT du lot** (nouveau modèle
      `LateFee`), **visible dans le relevé ET le compte du propriétaire** : `buildLedger` étendu (source
      « latefee »/« latefee_reversal », param optionnel → aucune régression) et branché dans `getLotAccount`
      + `getOwnerLotAccount`. **S'annule par écriture INVERSE** (frais négatif liant l'original, `chargeCallId`
      NULL pour ne pas rebloquer l'unicité), exactement comme un paiement — gardes double-annulation testées.
      Config + génération (syndic) dans les réglages ; annulation (staff) sur le compte du lot. Tests : pur
      (`computeLateFeeMinor`, `buildLedger` avec frais), écriture inverse + gardes, idempotence DB (5). Seed :
      frais activés sur Al Firdaous, **frais générés sur les impayés en retard** (dont 82,50 DH sur le lot du
      propriétaire de démo — 50 fixes + 5 % de 650). Vérifié connecté : relevé propriétaire avec le frais au
      débit (solde 732,50 DH), réglages (config + rappel juridique + génération) ; fr + ar (RTL intégral).
      Gate complet vert (298 PGlite, 113 Postgres réel).

- [x] **H3** — Le **bilan annuel** (le prototype avait le bouton, l'écran n'existait pas). `/bilan` (staff,
      `charge.view.all`) : **état comptable d'exercice** imprimable fr/ar (comme le reçu) à distribuer en
      assemblée — **total appelé, encaissé, dépensé, frais de retard, reste dû, trésorerie**, **dépenses par
      catégorie**, **contrats en cours**, et **la situation lot par lot** (appelé / réglé / frais / reste dû,
      solde cohérent avec le relevé). **Composition** de lectures existantes (`getTreasury`, `listExpenses` +
      `aggregateByCategory`, `listContracts`, agrégats de charges/paiements/frais par lot) — aucune logique
      nouvelle. Avertissement explicite : **sans valeur légale, ce n'est pas un procès-verbal**. Sélecteur
      d'exercice (courant + deux précédents). **Ajustement du seed** : Sara garde **A1 soldé** et **A7 en
      retard** (3 appels échus → 247,50 DH de frais) — on démontre la bascule entre lots ET les frais côté
      propriétaire ; l'annulation-démo (B2) déplacée hors de ses lots. Vérifié connecté en syndic : bilan
      2026 complet (appelé 48.650, reste dû 32.188,75, trésorerie 28.515), catégories, contrats, lot par lot ;
      fr + ar (RTL intégral). Gate complet vert (298 PGlite, 113 Postgres réel).

- [x] **H4** — Le **relevé mensuel du propriétaire** — l'artefact qu'un propriétaire absent attend.
      `/proprietaire/releve` (rôle PROPRIETAIRE) : un document **téléchargeable** (impression PDF, comme le
      reçu / le relevé) récapitulant **sa situation du mois** — appels, paiements, **frais de retard** —, son
      **solde à ce jour**, et les **dépenses VISIBLES de la résidence** sur la période. **Composition owner-safe**
      (`getOwnerMonthlyStatement`) : `getOwnerLotAccount` (vérifie la détention, ne touche jamais Person) filtré
      au mois + `listExpenses` avec `includeInternal: false`. Sélecteurs de **lot** (cas MRE) et de **mois**
      (trois derniers). **Téléchargement seulement** ; la composition est séparée de la page pour qu'un **envoi
      auto** (e-mail/WhatsApp) la réutilise plus tard côté serveur, sans refonte. Vérifié connecté en
      propriétaire : A1 (soldé, solde 0) et A7 (appel + 3 frais de retard, solde 2.197,50 DH), dépenses de la
      résidence du mois ; fr + ar (RTL intégral). Gate complet vert (298 PGlite, 113 Postgres réel).

- [x] **H5** — La **devise secondaire**. Un propriétaire à Bruxelles voit une **conversion INDICATIVE** à côté
      des dirhams, **dans son espace uniquement** ; les montants réels restent en MAD. Le **taux est une DONNÉE
      de configuration** (jamais un appel externe) : saisi par le **syndic dans les réglages, avec sa date**
      (`CurrencyRate` : `madPerUnitMinor` = centimes MAD pour 1 unité, unicité par devise → **extensible** à
      plusieurs devises). **Désactivée par défaut** ; **activée par le propriétaire** qui choisit sa devise sur
      **sa propre fiche** (`Person.secondaryCurrency`, via **person-access** — jamais celle d'un tiers). Affichage
      composé : `resolveSecondaryRate` croise le choix du propriétaire et le taux de sa résidence, et une note
      « conversion indicative » accompagne chaque montant. Branché sur le **montant dû** (accueil) et le **solde
      du relevé mensuel**. Migration `Person.secondaryCurrency` + table `CurrencyRate`. Test pur (`convertMinor`).
      Seed : taux **1 EUR = 10,75 MAD** sur Al Firdaous, le MRE de démo (Sara) en **EUR**, les autres en dirham.
      Vérifié connecté en propriétaire : montant dû A7 « 1.950,00 MAD ≈ 181 € · conversion indicative », sélecteur
      de devise, réglages (taux + date) ; fr + ar (RTL intégral). Gate complet vert (301 PGlite, 113 Postgres réel).

- [x] **H6** — Le **dépôt de documents par le propriétaire** (F3 n'avait construit le dépôt que côté syndic).
      `/proprietaire/documents` : déposer un document en **choisissant la portée AU DÉPÔT**, présentée
      clairement — « **visible par mon syndic** » (PARTAGE) ou « **privé, visible de moi seul** » (PRIVE, avec
      « même le syndic ne le voit pas ») —, **consulter, renommer et retirer LES SIENS** (garde `isOwnDocument` :
      jamais ceux d'un autre). Réutilise la **couche de stockage C0** et le **modèle de portées F3**
      (`documentVisibleTo`, déjà pur/testé) ; nouvelle permission `document.deposit.own` (COMMON, prête pour le
      locataire). **Étanchéité testée AVANT l'interface, au niveau du FICHIER** (`canServeDocument`, 4 tests
      PGlite + Postgres réel) : un document **PRIVÉ n'est jamais servi à un autre, syndic compris** — la faille
      (déjà fermée sur messagerie/incidents) est fermée sur le bucket « documents » de `/api/files`.
      **Vérifié en vrai** : le propriétaire sert son fichier privé (200), le **syndic ne le sert pas (404)** avec
      l'URL signée valide. Seed : le propriétaire de démo a déposé un **PARTAGÉ** (attestation) et un **PRIVÉ**
      (passeport). fr + ar (RTL intégral). Gate complet vert (305 PGlite, 117 Postgres réel).

- [x] **H7** — Le **profil du propriétaire** (le syndic saisissait tout, le propriétaire ne corrigeait rien).
      `/proprietaire/profil` : il consulte et modifie **SES** informations — **téléphone, langue préférée,
      devise secondaire** — et **son mot de passe**. Tout passe par **person-access** avec SON PROPRE personId
      (`getOwnProfile`, `updateOwnProfile`, `getAuthUserIdForSelf`) : **il n'édite jamais la fiche d'un autre**.
      Ce qu'il **ne peut pas** changer — **nom, lot, rôle** — est en lecture seule, avec la mention « géré par le
      syndic ». Le **changement de mot de passe EXIGE l'ancien** (`changePassword`, ne touche que `User`, vérif
      bcrypt puis longueur mini). La **langue préférée se répercute sur `preferredLocale`**, donc sur la langue
      des **relances WhatsApp**. **Tests écrits AVANT l'interface** (3, PGlite + Postgres réel) : `updateOwnProfile`
      modifie A sans toucher B et **ne change pas le nom** ; `changePassword` refuse un mauvais ancien, refuse un
      nouveau trop court, et n'affecte pas un autre compte. Vérifié connecté en propriétaire : édition du
      téléphone persistée (nom inchangé), formulaire de mot de passe ; fr + ar (RTL intégral). Gate complet vert
      (308 PGlite, 120 Postgres réel).

**Tranche H complète** — l'espace propriétaire couvre désormais tout ce que faisait le prototype (votes
exceptés) : incidents, frais de retard, bilan annuel, relevé mensuel, devise secondaire, dépôt de documents,
profil.

## Tranche I — Métier de la copropriété

- [x] **I1** — **Tantièmes** + **honnêteté du paiement simulé**. Le **calcul des appels devient configurable par
      résidence** (`Residence.chargeMode` FORFAIT | TANTIEMES, **FORFAIT par défaut** — beaucoup de petits
      immeubles marocains fonctionnent au forfait). En mode **tantièmes**, un **budget mensuel**
      (`monthlyBudgetMinor`) est **réparti aux quotes-parts** (`Lot.quotePart`, déjà renseigné) par une fonction
      **pure** `distributeByTantiemes` (méthode du **plus fort reste** : la somme des parts égale EXACTEMENT le
      total, aucun centime perdu — testé). L'**aperçu de génération** affiche le **mode**, la **quote-part** de
      chaque lot (`33/1000`) et le **montant** qui en découle, plus le total des tantièmes — le syndic voit d'où
      vient chaque montant. Config dans les réglages (`updateChargeModeAction`, tracée à l'audit). Seed :
      quotes-parts **pondérées par type** (une villa pèse plus qu'un appartement) pour une répartition
      démonstrative ; budget mensuel renseigné sur Al Firdaous (reste au forfait par défaut, bascule en tantièmes
      en un clic). **Honnêteté du paiement simulé** : au-delà du bandeau du tunnel, un **rappel PERMANENT**
      partout où le paiement en ligne est proposé — bandeau sur « Mes charges » (« le paiement en ligne est une
      simulation — aucun règlement réel ») + **étiquette « SIMULATION »** sur chaque bouton « Payer ». On ne
      laisse jamais croire qu'un vrai règlement a lieu. Vérifié connecté : aperçu tantièmes (A1 33/1000 → 495 DH,
      villa 65/1000 → 975 DH, total 15.000 DH exact), bandeau + étiquette de simulation ; fr + ar (RTL intégral).
      Migration `ChargeMode` + `Residence.chargeMode`/`monthlyBudgetMinor`. Gate complet vert (312 PGlite, 120
      Postgres réel).

- [x] **I2** — **Budget prévisionnel** + **fonds de provisions travaux**. Un **budget voté par catégorie et par
      exercice** (`BudgetLine`, unique `(résidence, exercice, catégorie)`), édité par le syndic (écran **Budget &
      fonds**, `setBudgetLineAction`, tracé à l'audit). Le **suivi budget/réalisé** par catégorie et au global,
      avec **écart** visible (budget − réalisé) — cœur **pur** `computeBudgetVsActual` (testé : fusion, signe de
      l'écart, tri, totaux). Le **réalisé** ne compte QUE les dépenses **courantes** (le fonds travaux en est
      toujours exclu). **Fonds de provisions travaux** STRICTEMENT distinct de la trésorerie courante : **appels
      dédiés** (`WorksFundContribution`, signés, **immuables** — annulation par **écriture inverse** comme les
      paiements/frais, gardes testées) et **dépenses imputées** (`Expense.onWorksFund`) ; **solde propre** =
      contributions − dépenses du fonds. Ni les appels ni ces dépenses n'entrent dans `getTreasury` ni dans les
      lectures courantes (`listExpenses` défaut `worksFund: 'exclude'`). Le **propriétaire** voit le budget/réalisé
      et le solde du fonds dans sa **transparence** (`includeInternal: false` — l'interne reste invisible, vérifié :
      réalisé propriétaire 12.610 vs syndic 15.710). Seed : budget voté par poste sur Al Firdaous (total 200.000
      DH), deux appels au fonds (80.000 DH) et une dépense imputée (ravalement 28.000 DH → solde 52.000 DH).
      Case **« Imputer sur le fonds travaux »** à la saisie de dépense. Vérifié connecté fr + ar (RTL intégral).
      Migration `budget_works_fund` (`Expense.onWorksFund`, `BudgetLine`, `WorksFundContribution`). Gate complet
      vert (319 PGlite, 122 Postgres réel).

- [x] **I3** — **Régularisation annuelle**. En fin d'exercice, on confronte les **provisions appelées** de l'année
      (somme des appels de charges par lot) à la **quote-part RÉELLE des dépenses courantes** (le total réparti aux
      **tantièmes** via `distributeByTantiemes`, au centime près — le fonds travaux est exclu). L'écart par lot
      (`adjustmentMinor` = quote-part − provisions) devient un **supplément** (positif, débit) ou un **avoir**
      (négatif, crédit) qui s'impute au **compte du lot** : nouvelle source du grand livre `buildLedger`
      (kind `regularisation`), visible côté **syndic ET propriétaire** (même `getLotAccount`/relevé). Cœur **pur**
      `computeRegularisation` (répartition exacte, écart signé, invariant écart global = dépenses − provisions —
      testé). **Non obligatoire** : le syndic la déclenche depuis l'écran **Régularisation** (prévisualisation →
      validation), **IDEMPOTENTE** (index partiel unique `(résidence, exercice) WHERE voidedAt IS NULL` — au plus une
      active par exercice, rejouer ne double jamais, testé sur Postgres réel) et **réversible** par annulation douce
      (comme un appel de charges — libère l'exercice). État **imprimable** (par lot : provisions, quote-part réelle,
      solde supplément/avoir + synthèse). Seed : une régularisation figée sur l'exercice courant d'Al Firdaous
      (dépenses réparties 15.710 DH vs provisions 48.650 DH → avoirs par lot). Vérifié connecté : écran syndic (écart
      global −32.940 DH, somme des quotes-parts = 15.710 DH exact), ligne « Régularisation — exercice 2026 » au
      crédit du compte du lot ; fr + ar (RTL intégral). Migration `regularisation` (`Regularisation` +
      `RegularisationLine`). Gate complet vert (329 PGlite, 125 Postgres réel).

- [x] **I4** — **Escalade de recouvrement** (rappel → mise en demeure) + **attestation de non-dette**. Le moteur de
      relances gagne une **étape** dérivée (`DunningItem.stage`) : en-deçà du seuil c'est un **RAPPEL** amiable
      (WhatsApp, existant), au-delà une **MISE EN DEMEURE**. Le seuil `formalNoticeThresholdDays` est
      **configurable par résidence** (`ReminderRule`, éditable dans les réglages, défaut 30 j ; validé ≥ seuil de
      relance). L'écran Relances affiche l'étape (badge) et, pour les lots escaladés, un lien vers une **lettre de
      mise en demeure imprimable** (fr/ar) : en-tête cabinet→résidence, destinataire, objet, corps formel (montant,
      périodes, retard, délai de régularisation de 15 j, réserve de poursuite). Son émission est **tracée** (canal
      `COURRIER`, `Reminder.kind = MISE_EN_DEMEURE`) — le texte affiché EST le texte persisté (preuve). Pas
      d'anti-harcèlement pour la lettre (réimprimable). **Attestation de non-dette** : document imprimable (fr/ar)
      délivré UNIQUEMENT quand le compte du lot est à jour (`balanceMinor ≤ 0`, source `getLotAccount`) ; refusée
      avec le reste dû sinon. Accessible **côté syndic** (compte du lot) ET **côté propriétaire** (self-service sur
      son propre lot, portée vérifiée). Cœurs testés : `evaluateDunning` (étape RAPPEL/MISE_EN_DEMEURE selon le
      seuil), validation du seuil (≥ relance), écriture `writeReminder` par courrier. Vérifié connecté : Relances
      (15 j → rappel, 46/76 j → mise en demeure), lettre A3 (1.950 DH, juin-août, 76 j), attestation A1 (Sara,
      soldé) fr + ar (RTL intégral). Migration `recouvrement_escalade` (enum `ReminderKind`, `Reminder.kind`,
      `ReminderChannel += COURRIER`, `ReminderRule.formalNoticeThresholdDays`). Gate complet vert (332 PGlite, 126
      Postgres réel).

- [x] **I5** — **Envoi réel d'e-mails** (fournisseur **Resend**), canal **abstrait** comme le stockage et le
      paiement (`src/server/mail/`). Interface `Mailer` + deux implémentations : `LogMailer` (dev : **journalise,
      n'envoie rien**) et `ResendMailer` (prod : API HTTP). Le choix est piloté par l'**environnement** via une
      fonction **pure** `resolveMailConfig` : on n'envoie qu'en **production ET** si `RESEND_API_KEY` est présente,
      sinon on journalise — le développement n'écrit **jamais** à un vrai résident. Passer à un vrai domaine = changer
      **`MAIL_FROM`** (variable), aucun code. Phase interne : **`MAIL_REDIRECT_TO`** force toutes les destinations
      vers l'adresse vérifiée (rien ne part aux résidents ; le destinataire visé est rappelé en tête). **Trois flux
      couverts** : lien magique (`sendVerificationRequest` → `sendEmail`), invitation d'un résident (additif au lien
      WhatsApp, si e-mail présent), et notification d'un **nouveau document** (portée RESIDENCE) ou d'une **nouvelle
      actualité** (audience ALL/OWNERS/TENANTS) — chaque résident reçoit l'e-mail **dans SA langue** (`normalizeLocale`
      + catalogue `mail` fr/ar), énumération via `person-access` (dédoublonnée, e-mails nuls ignorés). Gabarits purs
      (`renderEmail` : HTML inline + repli texte, échappement, RTL). Liens absolus dérivés des en-têtes de requête.
      Documenté dans **DEPLOYMENT.md** (création du compte Resend, clé d'API à poser dans Vercel, variables, et le
      jour du vrai domaine : enregistrements **DNS** SPF/DKIM/DMARC, vérification, bascule `MAIL_FROM` + retrait de
      `MAIL_REDIRECT_TO`) + `.env.example`. Tests : `resolveMailConfig` (dev journalise / prod+clé envoie),
      `ResendMailer` (fetch mocké : corps, en-tête, redirection, erreurs non bloquantes), `renderEmail`, gabarits
      fr/ar. Vérifié en dev (journalisé, non envoyé) : lien magique + fan-out d'actualité à ~23 résidents chacun dans
      sa langue (ar RTL / fr). **Aucune migration.** Gate complet vert (349 PGlite, 126 Postgres réel). ⚠ L'envoi
      réel en production reste inactif tant que l'utilisateur n'a pas créé le compte Resend et posé `RESEND_API_KEY`
      (+ `MAIL_FROM`, `MAIL_REDIRECT_TO`) dans Vercel — étapes détaillées dans DEPLOYMENT.md.

  _(I6 — notifications paramétrables + relevé mensuel auto — **retiré du périmètre** à la demande de l'utilisateur.)_

- [x] **I7** — **Travaux : devis comparatifs + photos avant/après**. Nouvelle entité **chantier** (`WorksProject`)
      qui regroupe des **devis comparatifs** (`WorksQuote` : fournisseur libre, montant, PDF du devis) et des
      **photos avant/après** (`WorksPhoto`, enum `WorksPhase` AVANT/APRES, fichier obligatoire). Le syndic crée un
      chantier, ajoute les devis reçus, **retient** l'un d'eux (`selectedQuoteId`, statut → EN_COURS), joint les
      photos, et fait avancer le statut (consultation → en cours → terminé). La comparaison marque automatiquement le
      **moins-disant** et le **devis retenu** — cœur **pur** `annotateQuotes` (testé : moins-disant unique, égalité,
      retenu ≠ moins-disant). **Transparence** : le propriétaire voit, dans son écran de transparence, les chantiers
      **PARTAGE** (jamais l'INTERNE) — les devis mis en concurrence, lequel a été retenu, et les photos avant/après.
      **Étanchéité** : nouveau **mur de service des fichiers** (`canServeWorksFile`, bucket `travaux`, ajouté au
      garde `/api/files/[id]`) — un chantier INTERNE ne sert jamais ses devis/photos à un résident (testé PGlite +
      Postgres réel : staff voit tout, propriétaire voit PARTAGE, jamais INTERNE). Fichiers via la couche C0
      (`storeFile`, validation type/taille), liens signés HMAC. Seed : un chantier « Réfection de l'étanchéité de la
      toiture » (3 devis 48/52/61 k DH → moins-disant Étanche Pro retenu, PDF par devis) + 2 photos avant/après
      (vraies images PNG générées par un mini-encodeur de seed). Vérifié connecté : liste + détail syndic (moins-disant
      + retenu, « voir le devis », galeries avant/après servies en 200 via le mur), fr + ar (RTL intégral). Migration
      `travaux` (enums `WorksStatus`/`WorksPhase`, `WorksProject`/`WorksQuote`/`WorksPhoto`). Gate complet vert (356
      PGlite, 129 Postgres réel).

- [x] **I8** — **Export des données + journal d'audit du propriétaire**. **Journal d'audit** (`/proprietaire/journal`)
      : l'historique chronologique des mouvements des lots du propriétaire (appels de charges, règlements avec n° de
      reçu, frais de retard, régularisations), fusionné sur ses lots et trié du plus récent au plus ancien. Source
      étanche : `getOwnerJournal` réutilise `getOwnerLotAccount` (contrôle de détention intégré) — le propriétaire ne
      voit JAMAIS le lot d'un voisin. Cœur **pur** `mergeJournalEntries` (tri, débit-avant-crédit à date égale,
      étiquetage du lot) + `journalLabel` (libellés réutilisant le namespace `account`), testés. **Export CSV** :
      helper **pur** `toCsv` (échappement RFC 4180, BOM UTF-8, séparateur `;`, testé). Le **propriétaire** exporte
      SON journal (`/proprietaire/journal/export`, gardé `charge.view.own`) ; le **syndic** exporte les **dépenses**
      de la résidence sur la période (`/depenses/export`, gardé `charge.view.all`, scope résidence). Étanchéité
      vérifiée en direct : le propriétaire reçoit son CSV (200) mais est **refusé (403)** sur l'export syndic.
      Vérifié connecté (fr + ar RTL) : journal des deux lots de Sara (A1+A7 — régularisation, frais de retard,
      appels, règlements), export CSV téléchargé et bien formé. **Aucune migration.** Gate complet vert (361 PGlite,
      129 Postgres réel).

## Règles permanentes

Textes via catalogues · propriétés logiques CSS uniquement · montants via le helper monétaire ·
aucun Prisma hors `src/server/` · toute action métier passe par le point d'application des autorisations ·
écrans réellement utilisables (formulaires validés, erreurs affichées, états vides traités) ·
vérifier l'inversion RTL en arabe au moins une fois par tranche.
