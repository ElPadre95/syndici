# État des lieux — Syndici

> Établi en **lisant le code** (pas de mémoire), au niveau du commit courant. Trois états :
> **✅ réel et fonctionnel** · **🟡 écran vide / placeholder** · **⛔ absent** (pas d'écran).

## 1. Écrans de la barre latérale (staff)

| Entrée nav | Route | État | Ce qu'elle fait vraiment |
|---|---|---|---|
| Tableau de bord | `/` | ✅ | Staff : lots, taux de collecte, reste dû, encaissé du mois, **trésorerie réelle**, **bandeau relances §7.1**. Résident : accueil sobre + **actualités** (E3). |
| Résidences | `/residences` | ✅ *partiel* | **Liste + création** d'une résidence. ⚠ **Pas d'édition** (ni réglages financiers, ni seuils, ni suppression via l'UI). |
| Lots | `/lots` | ✅ | Liste, fiche, création, génération en masse, **import Excel**, **relevé de compte** (B4), occupants (rattachements historisés), invitations. Le plus complet. |
| Résidents | `/residents` | 🟡 | **Placeholder** « bientôt ». La gestion des occupants existe **au niveau du lot** (`/lots/[id]/personne/nouvelle`), mais l'**annuaire résidence** est vide. |
| Invitations | `/invitations` | ✅ | Codes d'invitation résident : émission, liste (états), révocation. |
| Appels de charges | `/charges` | ✅ | Génération d'une campagne (idempotente, redevable dérivé) + suivi par période. |
| Paiements | `/paiements` | ✅ | Vue globale + encaissement sur la fiche du lot + reçus imprimables (B2/B3/B4). |
| Relances | `/relances` | ✅ | Détection §7.1 (anti-harcèlement) + **envoi WhatsApp** (message langue du destinataire, intention tracée). |
| Dépenses | `/depenses` | ✅ | Saisie + justificatif stocké (Blob), visibilité, filtres, répartition par catégorie, trésorerie. |
| Contrats | `/contrats` | ✅ | Échéances, compte à rebours, alerte visuelle §7.2. |
| Actualités | `/actualites` | ✅ | Publication typée + audience ; lecture résident filtrée. |
| Documents | `/documents` | 🟡 | **Placeholder** « bientôt ». Modèles `Document` + `DocumentScope` (PRIVE/PARTAGE/INTERNE) présents en base, **aucune UI**. |
| Réglages | `/reglages` | 🟡 | **Placeholder** « bientôt ». **Rien** : ni édition de résidence, ni réglage des seuils de relance, ni abonnement. |

## 2. Fonctionnalités demandées explicitement

- **Incidents avec fil de suivi** — ⛔ **absent**. Modèles `Incident` + `IncidentUpdate` présents ; **aucune logique serveur, aucun écran, aucune entrée nav.**
- **Documents avec portées de visibilité** — ⛔ **absent côté produit**. Le modèle et l'enum `DocumentScope` existent ; `/documents` est un stub. Rien ne crée, ne scope, ni n'affiche un document.
- **Frais de retard** — 🟡 **partiel, par conception**. La règle porte un seuil (`ReminderRule.lateFeeThresholdDays`) et un prédicat **pur** `lateFeeApplies(daysLate)` existe (`src/server/reminders/rule.ts`). **Mais rien ne génère ni n'ajoute un montant de frais** — conforme à l'intention SPEC (« aucun montant réellement ajouté », mention seulement). À noter : le message de relance actuel (E2) **ne mentionne même pas** encore les frais.
- **Réglages** (modifier une résidence, régler les seuils de relance, l'abonnement) — ⛔ **absent**. Les seuils §7.1 sont **configurables au niveau des données** (`ReminderRule`) mais **il n'existe aucun écran pour les changer** : ils sont figés au seed. L'abonnement vit sur `Residence.plan` mais n'est ni éditable ni facturé.
- **Bilan annuel destiné à l'AG** — ⛔ **absent**. SPEC mentionne un bouton « Générer le bilan annuel » ; il n'existe pas.
- **Gestion des membres de l'organisation** (inviter un gestionnaire) — ⛔ **absent**. Modèles `Organization` + `Membership` et droit `member.manage` présents ; **aucune UI** pour inviter/gérer un gestionnaire. Un cabinet ne peut pas déléguer à un gérant aujourd'hui.
- **Écran Résidents** — 🟡 placeholder (voir §1).
- **Écran Documents** — 🟡 placeholder (voir §1).

## 3. Autres fonctionnalités SPEC — état

- **Votes / AG en ligne** — ⛔ absent (modèles `Vote`/`VoteOption`/`Ballot` présents, le seed crée un vote, **aucune UI ni logique**).
- **Messagerie résident ↔ syndic** — ⛔ absent (modèles `Conversation`/`Message` présents, aucune UI).
- **Espace RÉSIDENT complet** (SPEC §3 : son compte, ses reçus, ses documents, paiement en ligne) — ⛔ absent. Seul existe l'**accueil sobre invité** + les actualités (E3). Le résident MRE ne peut pas encore consulter son relevé ni ses reçus lui-même.
- **Réveil Neon / performance** — corrigé côté infra (voir plus bas).

## 4. Ce qui manque, classé par ce qu'un syndic marocain réclamera EN PREMIER

1. **Réglages de la résidence** — éditer la résidence **et surtout régler les seuils de relance** (sinon le moteur §7.1 n'est pas pilotable par le syndic, alors que c'est vendu comme configurable). *Indispensable.*
2. **Gestion des membres du cabinet** — inviter un gestionnaire. Un cabinet marocain gère plusieurs résidences à plusieurs ; sans délégation, le produit ne sert qu'un solo. *Indispensable si le client est un cabinet.*
3. **Annuaire Résidents** — voir d'un coup tous les occupants/propriétaires d'une résidence (aujourd'hui uniquement lot par lot). Un écran de nav **vide** fait mauvais effet en démo.
4. **Documents avec portées** — factures, PV d'AG, règlement intérieur, partagés aux résidents. C'est le cœur du pitch « transparence » ; l'écran est vide.
5. **Incidents avec fil de suivi** — un syndic gère des pannes et réclamations en continu ; c'est un usage quotidien.
6. **Espace résident complet** — le MRE veut voir SON compte et SES reçus sans appeler le syndic. C'est la moitié « résident » de la promesse.
7. **Bilan annuel (AG)** — document saisonnier mais attendu chaque année.
8. **Frais de retard réels** — à trancher : les facture-t-on vraiment, ou reste-t-on sur la simple mention (comme le prototype) ?
9. **Votes en ligne, messagerie** — différenciants, mais pas au premier rendez-vous.

## 5. Indispensable AVANT de montrer le produit à un vrai syndic

Trois écrans de la navigation mènent à un **« bientôt »** — c'est le plus gênant : le syndic clique et tombe dans le vide.

- **Réglages** — au minimum : éditer la résidence + régler les seuils de relance. Sans ça, la démo montre une configuration figée qu'on ne peut pas ajuster devant le client.
- **Documents** — au moins la **consultation** (le partage de la facture RADEEMA est l'argument de vente ; il n'existe qu'au niveau d'une dépense, pas comme espace documentaire).
- **Résidents** — remplacer le placeholder par un vrai annuaire de la résidence.

Le reste (incidents, bilan annuel, espace résident complet, votes) peut attendre un deuxième cycle, mais **ces trois écrans vides doivent disparaître** avant une vraie démo.

---

### Annexe — Performance production (corrigé)

Diagnostic mesuré : les fonctions Vercel tournaient en **iad1 (Washington)** alors que Neon
est à **Francfort** → chaque requête traversait l'Atlantique (~90-180 ms). Corrigé :
`vercel.json regions=["fra1"]` (fonctions co-localisées), `DATABASE_URL` repassé sur la
chaîne **poolée**, `getSessionContext` mémoïsé (`react/cache`). Aller-retour DB : **~180 ms
→ ~14 ms** (même région). Réserve : **réveil Neon ~750 ms** après ~5 min d'inactivité
(offre gratuite Neon).
