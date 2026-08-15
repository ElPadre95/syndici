# État des lieux — Syndici

> Établi en **lisant le code** (pas de mémoire), au niveau du commit courant (fin tranche H).
> Trois états : **✅ réel et fonctionnel** · **🟡 partiel** · **⛔ absent**.
>
> Depuis la version précédente de ce document (mi-août, avant les tranches F/R/G/H), **les
> trois écrans « bientôt » ont disparu** : Résidents, Documents et Réglages sont réels, et
> tout un espace propriétaire a été construit. **Aucune entrée de navigation ne mène plus
> dans le vide.**

## 1. L'état des écrans

### 1a. Espace syndic (barre latérale)

| Entrée nav | Route | État | Ce qu'elle fait vraiment |
|---|---|---|---|
| Tableau de bord | `/` | ✅ | Lots, taux de collecte, reste dû, encaissé du mois, **trésorerie réelle**, bandeau relances §7.1. |
| Résidences | `/residences` | ✅ | Liste + création. L'**édition** (nom, adresse, charges par défaut, jour d'échéance) se fait désormais dans **Réglages**. Pas de suppression via l'UI (assumé). |
| Lots | `/lots` | ✅ | L'écran le plus complet : liste, fiche, création, génération en masse, **import Excel**, **relevé de compte**, occupants (rattachements historisés), invitations. |
| Résidents | `/residents` | ✅ | **Annuaire de la résidence** (F2) : une ligne par personne, ses lots agrégés (MRE multi-lots jamais dédoublé), état du compte. *(Était un placeholder.)* |
| Invitations | `/invitations` | ✅ | Codes d'invitation : émission, liste (états), révocation. |
| Appels de charges | `/charges` | ✅ | Génération d'une campagne idempotente + suivi par période. **Montant au forfait** (`monthlyChargeMinor` par lot), pas aux tantièmes — voir §2. |
| Paiements | `/paiements` | ✅ | Vue globale + encaissement sur la fiche du lot + reçus imprimables (numéro de séquence). Annulation par écriture inverse. |
| Relances | `/relances` | ✅ | Détection §7.1 (anti-harcèlement) + **envoi WhatsApp** (message dans la langue du destinataire, intention tracée). **Un seul niveau** — pas d'escalade — voir §2. |
| Dépenses | `/depenses` | ✅ | Saisie + justificatif stocké (Blob), visibilité (PARTAGE/INTERNE), filtres, répartition par catégorie, trésorerie. |
| Contrats | `/contrats` | ✅ | Échéances, compte à rebours, alerte §7.2. |
| Bilan annuel | `/bilan` | ✅ | **(H3)** État comptable d'exercice imprimable fr/ar : appelé/encaissé/dépensé/frais/reste dû/trésorerie, dépenses par catégorie, contrats, situation lot par lot. Descriptif, **pas** une régularisation — voir §2. |
| Incidents | `/incidents` | ✅ | **(H1)** Liste triée par urgence/ancienneté, fil de suivi horodaté, changement de statut, affectation fournisseur, **lien vers la dépense** (boucle de transparence). |
| Actualités | `/actualites` | ✅ | Publication typée + audience ; lecture résident filtrée. |
| Documents | `/documents` | ✅ | **(F3)** Dépôt (titre, type, portée), liste filtrée par l'étanchéité, service par route signée. *(Était un placeholder.)* |
| Messagerie | `/messagerie` | ✅ | **(G4)** Conversations de la résidence groupées par lot, rôle de l'interlocuteur visible ; fil + pièces jointes. |
| Réglages | `/reglages` | ✅ | **(F1/F4/H2/H5)** Édition de la résidence, **seuils de relance**, **frais de retard** (config), **taux de change**, catégories de dépenses, **membres du cabinet** (inviter/gérer un gestionnaire), abonnement. *(Était un placeholder.)* |

**15/15 entrées syndic mènent à un écran réel.** Écrans hors nav mais réels : génération de lots/charges, import, nouvelle dépense, fiche/relevé/compte d'un lot, reçus.

### 1b. Espace propriétaire (barre latérale)

| Entrée nav | Route | État | Ce qu'elle fait vraiment |
|---|---|---|---|
| Tableau de bord | `/` | ✅ | **(G1)** « Où j'en suis » : situation par lot (montant dû + échéance + retard), indicateur collectif (nombres, jamais d'identité), actualités, documents ; **conversion devise indicative** (H5) et sélecteur de devise. |
| Mes charges | `/proprietaire/charges` | ✅ | **(G2)** Historique des appels (statut dérivé), paiements + n° de reçu + réimpression, lien vers le relevé, **bouton « Payer »** (paiement simulé, si activé). |
| Relevé mensuel | `/proprietaire/releve` | ✅ | **(H4)** Document téléchargeable : activité du mois (appels, paiements, frais), solde à ce jour, dépenses visibles de la résidence. |
| Incidents | `/proprietaire/incidents` | ✅ | **(H1)** Signaler (lot ou partie commune, urgence, photo) et suivre ; voit l'intervention et la facture reliées. |
| Mes documents | `/proprietaire/documents` | ✅ | **(H6)** Déposer avec **choix de la portée au dépôt** (partagé avec le syndic / privé), renommer, retirer les siens. |
| Transparence | `/proprietaire/transparence` | ✅ | **(G3)** Dépenses visibles + par catégorie + justificatifs (route signée), budget/trésorerie, contrats. |
| Mon profil | `/proprietaire/profil` | ✅ | **(H7)** Téléphone, langue préférée, devise secondaire, mot de passe (ancien exigé) ; nom/lot/rôle en lecture seule. |

**7/7 entrées propriétaire mènent à un écran réel.** Écrans hors nav mais réels : **bulle de messagerie** (G4), **tunnel de paiement simulé** `/proprietaire/payer/[id]`, **relevé de compte** `/proprietaire/lots/[id]/compte`, **reçu** `/proprietaire/recus/[id]`.

**Murs d'étanchéité vérifiés (tests + fichier réel)** : messagerie (fil propriétaire ≠ fil locataire), incidents (lots propres + parties communes), documents (un privé n'est jamais servi à un autre, syndic compris), transparence (INTERNE invisible), lectures propriétaire sans accès au modèle Person.

### 1c. Espace locataire

**Volontairement reporté.** Un locataire connecté tombe sur l'**accueil sobre** (actualités + documents de la résidence) et **aucune fonction de gestion ni écran propriétaire**. Le modèle porte déjà son fil de messagerie (le syndic peut lui écrire) et ses rattachements, mais il n'a **pas encore d'écran** pour lire ce fil, ses charges ou ses documents. L'ajouter sera une **différenciation de droits**, pas une refonte.

## 2. Ce qui manque au métier de la copropriété

> C'est ici l'essentiel. Presque tout ce qui suit est de la **comptabilité de copropriété
> réelle** que ni le prototype ni les tranches actuelles n'ont construite. Le produit
> d'aujourd'hui est un **excellent suivi d'encaissement et de transparence** — mais pas
> encore un **outil comptable de syndic** au sens de la loi 18-00.

| Fonction | État | Détail (vérifié dans le code) |
|---|---|---|
| **Exercice comptable & régularisation annuelle** | ⛔ | Les charges sont des **forfaits mensuels** appelés tels quels. **Aucune** notion de provision vs réel, **aucune** régularisation de fin d'exercice, **aucun** complément/crédit par copropriétaire. Le « bilan annuel » (H3) **décrit** l'exercice, il ne le **régularise pas**. |
| **Budget prévisionnel voté + suivi budget/réalisé** | ⛔ | Pas de modèle de budget. Le bilan montre le réalisé, sans budget voté auquel le comparer. |
| **Provisions pour travaux (fonds travaux)** | ⛔ | « TRAVAUX » n'existe que comme catégorie de dépense / type d'actualité. **Aucun fonds ni provision** distinct du budget courant. |
| **Appels aux tantièmes (quotes-parts)** | ⛔ | `Lot.quotePart` existe mais est **explicitement « non utilisé pour le tally »** ; l'appel = `monthlyChargeMinor` du lot (forfait). Pas de répartition d'un budget aux tantièmes — **non conforme** à la répartition légale des charges communes. |
| **Escalade du recouvrement (amiable → rappel → mise en demeure + courrier)** | 🟡 | **Un seul niveau** : détection §7.1 + relance WhatsApp amiable. Pas de niveaux d'escalade, **pas de mise en demeure, aucun modèle de courrier**. Les frais de retard (H2) existent, mais séparément et jamais automatiques. |
| **Devis comparatifs avant travaux** | ⛔ | Aucun modèle de devis, aucune consultation par les copropriétaires. |
| **Photos avant/après sur interventions** | 🟡 | Un incident porte **une** photo au signalement (`photoId`). Pas de couple avant/après ni de galerie d'intervention. |
| **Export complet des données (propriétaire / résidence)** | ⛔ | L'**import** Excel existe ; **aucun export** (ni CSV, ni PDF global, ni archive de reprise de mandat). |
| **Journal d'audit consultable par le propriétaire** | ⛔ | L'`AuditLog` est **écrit** (paiements, frais, statuts, config…) mais **aucune vue ne l'affiche** — ni syndic, ni propriétaire. Le propriétaire voit le fil d'un incident, pas un journal. |
| **Notifications paramétrables par personne** | ⛔ | Seuls des drapeaux au niveau **résidence** (`autoReminder`, `autoSmsReminder`, `autoMonthlyReport`). Aucune préférence par personne. |
| **Envoi automatique du relevé mensuel** | ⛔ | Le relevé (H4) est en **téléchargement seul**. `Residence.autoMonthlyReport` existe mais **n'est branché à aucun envoi** (conçu pour être ajouté sans refonte). |

### Ce que j'ajoute (non listé, mais manquant)

| Fonction | État | Détail |
|---|---|---|
| **Envoi réel (email / WhatsApp / SMS)** | ⛔ | **Rien n'est réellement envoyé.** La relance WhatsApp **trace une intention** (message généré, canal choisi) mais **aucun fournisseur n'est branché**. Aucun email transactionnel (reçu, invitation, relevé) n'est expédié. C'est probablement le plus gros écart « invisible » : le produit paraît notifier, il ne notifie pas. |
| **Paiement en ligne RÉEL** | 🟡 | Seul le **MockProvider (simulation)** existe ; l'abstraction `PaymentProvider` est prête, mais **aucun prestataire réel** (CMI/PayZone) n'est branché et la plateforme n'encaisse rien. |
| **Rapprochement bancaire** | ⛔ | Paiements saisis à la main ; **aucun import de relevé bancaire**, aucun rapprochement automatique. |
| **Cycle d'assemblée (convocation, ordre du jour, feuille de présence, PV)** | ⛔ | Seul le **PV en tant que document** existe. Aucun cycle AG. |
| **Votes / AG en ligne** | ⛔ | Modèles `Vote`/`VoteOption`/`Ballot` présents, le seed crée un vote, **aucune UI ni logique**. |
| **Attestation de non-dette / quitus** (souvent exigée à la vente d'un lot au Maroc) | ⛔ | Aucun document de ce type généré. |
| **Suivi des sinistres / assurance** au-delà du contrat | ⛔ | Le contrat d'assurance est un simple contrat à échéance ; pas de déclaration/suivi de sinistre. |

## 3. Le classement — ce qu'un syndic marocain réclamera EN PREMIER

Classé par **demande réelle du métier**, pas par facilité :

1. **Régularisation annuelle des charges** (provisions → réel → complément/crédit). *C'est LA question qu'un syndic pose en premier.* Sans elle, le produit est un suivi d'encaissement, pas une comptabilité de copropriété.
2. **Appels aux tantièmes**. La répartition des charges communes **aux quotes-parts** est la base légale (loi 18-00) ; le forfait par lot ne passe pas un examen sérieux.
3. **Budget prévisionnel voté + suivi budget/réalisé**. L'AG vote un budget, le syndic appelle des provisions contre lui. Indissociable des points 1 et 2.
4. **Escalade du recouvrement + mise en demeure (modèle de courrier)**. Le recouvrement est le quotidien ; la mise en demeure est l'étape légale avant contentieux.
5. **Envoi réel des notifications** (relevé mensuel automatique, relances, reçus par email/WhatsApp). Le MRE veut être **poussé**, pas obligé de venir chercher.
6. **Provisions pour travaux (fonds travaux)**. De plus en plus attendu, surtout sur les grosses copros.
7. **Export complet des données**. Réclamé à chaque reprise de mandat ou audit ; un syndic ne signe pas s'il ne peut pas récupérer ses données.
8. **Devis comparatifs consultables** — argument de transparence fort côté copropriétaires.
9. **Photos avant/après**, **journal d'audit côté propriétaire**, **notifications par personne** — finitions de confiance.
10. **Paiement en ligne réel**, **rapprochement bancaire**, **votes/AG en ligne** — différenciants, pas au premier rendez-vous (au Maroc l'espèce domine encore).

### Indispensable AVANT de montrer le produit à un vrai syndic

Les **écrans** ne sont plus le problème (plus aucun « bientôt »). Le risque est désormais **métier** : un syndic marocain jugera le **modèle comptable** dans les cinq premières minutes.

- **La régularisation annuelle et les tantièmes (points 1 et 2)** sont le vrai test. Un modèle « forfait sans régularisation » révèle que le produit n'est **pas bâti sur la comptabilité de copropriété réelle** — c'est le seul manque qui peut disqualifier la démo d'entrée.
- **L'envoi réel (point 5)** : la relance et le relevé donnent l'impression de partir mais **ne partent pas**. À clarifier avant de le montrer, sous peine de promettre une automatisation inexistante.
- **La mise en demeure (point 4)** est la deuxième question du syndic (« et quand il ne paie pas ? »).

Le reste (fonds travaux, export, devis, votes, espace locataire) peut attendre un cycle — mais **la comptabilité provisionnelle/tantièmes/régularisation est le socle qui sépare une démo convaincante d'un outil qu'un syndic adopte vraiment.**

---

### Annexe — Performance production (corrigé, toujours valable)

Fonctions Vercel co-localisées avec Neon (`vercel.json regions=["fra1"]`), `DATABASE_URL`
poolée, `getSessionContext` mémoïsé. Aller-retour DB **~180 ms → ~14 ms**. Réserve
connue : **réveil Neon ~750 ms** après inactivité (offre gratuite). Le mot de passe de démo
(`DEMO_SYNDIC_PASSWORD`) est désormais **présent dans l'env Vercel** — les comptes de démo
ne s'orphelinent plus au reseed.
