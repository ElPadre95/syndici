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
- [ ] **E3** — Actualités (type, titre, corps, audience ; lecture côté résident).

## Règles permanentes

Textes via catalogues · propriétés logiques CSS uniquement · montants via le helper monétaire ·
aucun Prisma hors `src/server/` · toute action métier passe par le point d'application des autorisations ·
écrans réellement utilisables (formulaires validés, erreurs affichées, états vides traités) ·
vérifier l'inversion RTL en arabe au moins une fois par tranche.
