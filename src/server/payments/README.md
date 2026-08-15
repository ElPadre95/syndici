# Couche paiement

Cette couche règle un **appel de charges** via un **prestataire de paiement** abstrait
(`PaymentProvider`, voir `provider.ts`). Aujourd'hui, une seule implémentation existe : le
**`MockProvider`** — une **SIMULATION** utilisée pour la démonstration.

## Ce que fait le tunnel simulé

1. Le **propriétaire** d'un lot (jamais le staff) clique « Payer » sur un appel **où il
   reste quelque chose à régler**.
2. Un tunnel affiche un **bandeau permanent « simulation »** à chaque étape, un
   récapitulatif, puis un bouton « Simuler le paiement ». **Aucun champ de carte, aucune
   donnée bancaire n'est demandée ni collectée** — on simule le *parcours*.
3. À la confirmation, le paiement est **réellement enregistré** via
   `writePayment` (mode `EN_LIGNE`) : écriture immuable + **allocation** à l'appel +
   **reçu numéroté** par la séquence sans trou existante + trace d'audit. Le règlement est
   fictif ; l'écriture comptable de démonstration, elle, est vraie.
4. Le tunnel est **désactivé par défaut** et n'est ouvert que si
   `Residence.onlinePaymentEnabled = true` (activé sur la seule résidence de démo).

## Ce qu'un adaptateur RÉEL devra fournir

Pour brancher un vrai prestataire (CMI, PayZone, Stripe…), implémenter `PaymentProvider` :

- **`createCheckout(intent)`** : ouvrir une **session hébergée chez le prestataire**
  (page de paiement du prestataire). L'application **ne voit jamais** le numéro de carte ;
  la saisie se fait **chez le prestataire**, sur son domaine (PCI-DSS à sa charge).
- **`confirm(checkoutId)`** : confirmer **après vérification du webhook signé** du
  prestataire (ne jamais faire confiance au retour navigateur seul). Gérer
  l'**idempotence** (un même règlement ne doit produire qu'un seul `Payment`).
- **Rapprochement / remboursement** : prévoir la référence opposable (`providerRef`) et un
  chemin d'annulation (qui, côté Syndici, reste une **écriture inverse** — jamais une
  suppression).
- **Sélection** : le provider d'une résidence sera choisi à partir de son
  `SettlementAccount` **ACTIF** (provider + `merchantId`).

## Contrainte connue — NON NÉGOCIABLE

**La plateforme ne doit JAMAIS détenir les fonds.** Le règlement doit aller **directement**
au compte d'encaissement du **syndic** (`SettlementAccount` de la résidence/organisation) ;
Syndici **enregistre** le paiement et **émet le reçu**, mais n'est **ni dépositaire ni
intermédiaire financier** des sommes. Tout adaptateur réel doit configurer le prestataire
en **règlement direct vers le marchand** (le syndic), pas vers un compte de la plateforme.
