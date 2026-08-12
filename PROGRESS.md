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
- [ ] **A7** — Import Excel de lots + occupants : aperçu avant validation, rapport des lignes rejetées.

## Règles permanentes

Textes via catalogues · propriétés logiques CSS uniquement · montants via le helper monétaire ·
aucun Prisma hors `src/server/` · toute action métier passe par le point d'application des autorisations ·
écrans réellement utilisables (formulaires validés, erreurs affichées, états vides traités) ·
vérifier l'inversion RTL en arabe au moins une fois par tranche.
