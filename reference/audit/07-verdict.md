# 07 — Verdict

## Question : reprendre ce code, ou réécrire ?

**Recommandation nette : réécrire l'application (Next.js + PostgreSQL/Prisma), en conservant ce code
existant comme _spécification vivante_ et bibliothèque d'UI, non comme socle technique.**

Ce n'est pas un « ça dépend ». C'est une réécriture, mais une réécriture *assistée* par un actif réel :
le prototype vaut cher comme cahier des charges et comme design, presque rien comme fondation.

Je détaille pourquoi, et ce qui doit être décidé avant de lancer.

---

## 1. Ce qui a une valeur réelle et serait coûteux à reproduire

Précis, pas général :

1. **La conception produit et les parcours** — 23 écrans pensés pour le métier marocain : dashboard trésorerie, fiche résident avec dossier interne vs partagé, relances WhatsApp multilingues avec aperçu éditable, moteur anti-harcèlement (`detecterRelancesNecessaires`, exclusion <4 j, retard ≥3 j), widget de transparence collective (pression sociale sans nommer), inscription par code d'accès, bilan AG imprimable. **C'est des semaines de réflexion produit déjà faites et validables.**
2. **Le design system** — ~530 lignes de CSS cohérent (variables, cartes, KPI, sheets, pills, hero), une identité visuelle crédible. Réutilisable quasi tel quel dans des composants React.
3. **Les textes métier** — messages de relance rédigés en fr/en/nl/ar (`relanceMessages`), ~400 clés i18n françaises et arabes, vocabulaire immeuble/villa/mixte, catégories de dépenses distinctes par type. Le contenu (le plus long à écrire) existe.
4. **La logique métier de référence** — calcul de taux de collecte, statuts paid/late/partial, adaptation vocabulaire/catégories au type de résidence, génération de reçus/justificatifs, structure du bilan. À réimplémenter côté serveur, mais l'algorithme est là et lisible.
5. **Le schéma de données de départ** — 11 tables déjà dessinées (03), un bon point de départ Prisma (à corriger pour propriétaire/locataire et tantièmes).

Reproduire tout cela de zéro = plusieurs semaines. **On ne jette pas ça : on le porte.**

## 2. Ce qui est irrécupérable, et pourquoi c'est structurel

1. **La logique métier vit dans le client, mélangée au rendu.** L'argent, les statuts, la numérotation des reçus, la détection des relances sont calculés dans des fonctions qui produisent du HTML. Il n'existe **aucune couche métier isolable** à extraire. Reprendre le fichier = reprendre cette diffusion. C'est structurel, pas cosmétique.
2. **Le modèle de sécurité est absent par conception.** SELECT anonyme sur `residents` (C1), chargement de toute la résidence côté résident (C2), écriture dans une résidence arbitraire sans session (C3), rattachement de dossier par email (C5), échecs masqués (C6), XSS stocké généralisé (C7). Ce ne sont pas des bugs isolés : c'est l'absence d'un modèle « qui peut lire/écrire quoi ». Pour un produit qui **vend la confiance financière à des absents**, c'est le cœur, et il est à refaire entièrement.
3. **La fiabilité comptable n'existe pas.** Numéros de reçu en collision (C9), paiement carte qui affiche un succès sans rien persister (C8), erreurs DB silencieuses (M10), date d'échéance figée (M1). Une appli de syndic qui produit des reçus non uniques et des « paiements » fantômes est inutilisable en réel.
4. **Le rendu `innerHTML`/template-strings ne passe pas l'échelle** ni la sécurité (XSS, re-render O(n) total, base64 en base). À 100 résidences × 1000 unités, ça s'effondre (05, section échelle).
5. **Le modèle « résident unique »** est incompatible avec le métier réel (voir §4).

Aucun de ces points ne se corrige par retouches : ils touchent l'architecture (où vit la logique),
le modèle de données (rôles) et le modèle de sécurité (RLS/serveur). D'où : réécriture.

## 3. Coût et risque de chaque option

| Option | Effort | Risque |
|---|---|---|
| **Reprendre le fichier connecté** | Faible au départ, **croissant et piégeux** : chaque fonctionnalité réelle (paiement, sécurité, reçus fiables, rôles) oblige à défaire l'existant. | **Élevé** : on hérite des failles C1-C9 et on risque de les livrer ; dette qui se paie au pire moment (premier vrai client, premier incident RGPD). |
| **Réécrire from scratch en ignorant l'existant** | **Élevé** : on refait le produit, le design, les textes, les parcours. | Moyen : on perd le bénéfice du travail produit déjà fait ; risque de re-diverger du besoin. |
| **Réécrire en portant l'existant comme spec + UI (recommandé)** | **Moyen** : nouvelle architecture Next.js/Prisma, mais on copie CSS, textes, parcours, algorithmes. | **Faible à moyen** : sécurité et fiabilité correctes dès le départ ; on capitalise sur le prototype. |

## 4. Ce que ce code impose ou ferme (points non tranchés, Partie 1)

1. **Qui paie (syndic vs MRE)** — le code suppose le syndic (auth syndic = propriétaire de la résidence, `residences.user_id`). **Rien ne ferme** l'autre option, mais tout est construit autour du syndic ; un modèle « le MRE paie pour la visibilité » demanderait un autre découpage des comptes. Décision produit, pas contrainte technique forte.
2. **Mise en relation / annuaire de prestataires** — **totalement absente**. Ni schéma, ni écran. À concevoir de zéro quelle que soit l'option. Ne milite ni pour ni contre la reprise.
3. **Paiement en ligne** — le tunnel « Stripe » est **décoratif** (C8) ; aucune intégration réelle. Le code **n'impose rien** (il ne fait rien). La vraie contrainte est externe (Stripe indisponible au Maroc, agrément établissement de paiement) et **doit être tranchée avant** d'écrire quoi que ce soit de financier. Tel quel, le code entretient l'illusion d'un paiement qui n'existe pas — à retirer ou à remplacer par un vrai PSP marocain (CMI, PayZone…) le moment venu.
4. **Propriétaire vs locataire** — **c'est le point décisif.** Le code ne connaît qu'un rôle « résident » (`residents`, `_residentData`, un seul jeu de droits). Or le métier visé distingue : le **propriétaire** (souvent MRE, doit les charges, vote, quote-part) et le **locataire** (occupe, signale les incidents). 
   - **Greffable sur cette base ?** Non proprement. Il faudrait : séparer `personnes` et `lots` (aujourd'hui fusionnés dans `residents`), introduire des liens propriétaire→lot et locataire→lot, des tantièmes/quote-part (absents), et des droits différenciés (vote/charges vs signalement) — qui traversent l'auth, le modèle de données, la RLS et **presque tous les écrans** (fiche, paiements, votes, signalements). Sur le code actuel où « résident » est partout en dur et la logique est côté client, cette distinction **impose une refonte du modèle**, pas une greffe. C'est un argument fort de plus pour la réécriture : autant poser le bon modèle (personne/lot/rôle/quote-part) dès le départ dans Prisma.

## 5. Voie intermédiaire crédible

Oui, et c'est la recommandation opérationnelle :

**« Réécriture portée » en 3 temps.**
1. **Figer le prototype comme spécification** : il tourne, on le montre, on valide les parcours avec de vrais syndics/MRE. Aucune ligne n'est jetée tant que le remplaçant n'est pas prêt.
2. **Réécrire le socle** en Next.js + Postgres/Prisma avec, dès le premier jour : modèle personne/lot/rôle/quote-part (propriétaire ⁄ locataire) ; logique métier serveur (montants, statuts, **numérotation de reçu transactionnelle et unique**) ; auth + autorisation serveur (pas « RLS supposée ») ; Supabase Storage (ou S3) pour les pièces ; échappement systématique (React protège nativement du XSS de C7).
3. **Porter écran par écran** en réutilisant CSS, textes i18n et algorithmes du prototype. Trancher Stripe/PSP et le modèle payeur **avant** de coder le module financier.

Ce que je **déconseille** : partir de `index-connecte.html` et « le nettoyer ». Le nettoyage reviendrait à réécrire la logique et la sécurité tout en luttant contre un mono-fichier de 6787 lignes sans couche métier — le pire des deux mondes.

## 6. À décider / savoir avant de lancer

1. **Propriétaire vs locataire + tantièmes** : le modèle de données en dépend entièrement. À trancher en premier.
2. **PSP et montage juridique du paiement** (Stripe non, quel prestataire marocain, quel statut réglementaire pour encaisser des charges) : conditionne tout le module financier ; sans réponse, ne pas écrire de code d'encaissement.
3. **Qui est le client payant** (syndic vs MRE) : oriente l'onboarding et le découpage des comptes.
4. **État réel des policies RLS Supabase actuelles** : à vérifier (test requête anonyme) — non pour reprendre, mais pour mesurer l'exposition **immédiate** des données déjà saisies dans le projet `xlhjuzbkbyndqjanddht` (fuite potentielle en cours).
5. **Périmètre du MVP** : messagerie (à refaire, aujourd'hui en mémoire), navigation mobile (régressée), multilingue (nl/es/de à compléter) — à prioriser.

---

## Conclusion en une phrase
Le prototype est un **excellent cahier des charges exécutable et un bon design**, mais une **mauvaise
fondation technique** : réécrire en Next.js/Prisma en portant son UI, ses textes et ses parcours, avec
un vrai modèle propriétaire/locataire et une logique+sécurité côté serveur — et **ne pas** tenter de
sauver le mono-fichier connecté.
