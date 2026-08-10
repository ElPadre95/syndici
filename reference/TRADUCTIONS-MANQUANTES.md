# Traductions manquantes — arabe (ar)

Document généré pour faire traduire ce qui manque. **Je ne traduis rien ici : je signale.**

## Méthode

Extraction de l'objet `translations` du prototype (`reference/index-demo.html`), locales `fr` et `ar`
uniquement, puis comparaison des **ensembles de clés effectives** (après dédoublonnage JS « last-wins »,
car le prototype contient des clés dupliquées — anomalie documentée : audit `05-anomalies.md` M6 / point 13).

« Manquant » = clé **présente en fr** et **absente en ar**, au niveau des clés effectives.

## Décompte — et pourquoi « 577 vs 403 » est trompeur

| Mesure | fr | ar |
|---|---|---|
| Occurrences brutes de `clé:` dans l'objet (avec doublons) | **577** | **400** |
| Clés **uniques / effectives** (après dédoublonnage) | **401** | **398** |

Le chiffre « ~577 fr / ~403 ar » correspond aux **occurrences brutes** : l'objet `fr` du prototype est
gonflé par un copier-coller qui y a empilé des clés en de/nl/es/en (toutes dupliquées, la dernière
écrasant les précédentes). Une fois dédoublonné, **fr = 401 clés uniques, ar = 398**. L'écart réel
n'est donc **pas** de ~174 clés, mais de **3 clés**.

## Clés à traduire (fr présent, ar absent) — 3 clés

Le chemin catalogue est l'emplacement dans `messages/ar.json` où la valeur traduite doit être ajoutée.

### residents (3)

| clé prototype | chemin catalogue (messages/ar.json) | texte source (fr) |
|---|---|---|
| `app_nationalite` | `residents.appNationalite` | Nationalité |
| `app_telephone` | `residents.appTelephone` | Téléphone |
| `app_tous` | `residents.appTous` | Tous |

## Clés présentes en ar mais absentes en fr

Aucune (`ar \ fr = 0`).

## Contrôle qualité (au-delà de la simple présence)

« Présent » ne veut pas dire « correctement traduit ». Recherche des valeurs `ar` **identiques** à la
valeur `fr` (signe d'une traduction oubliée) : **1 seule** occurrence, et elle est **intentionnelle** —
`locale.fr = "Français"` (le nom de la langue, affiché tel quel dans le sélecteur, dans les deux locales).
Le reste du catalogue `ar` est en écriture arabe. La couche de vocabulaire adaptatif (`vocabulaire.*`)
est complète en ar.

## Portée

Seules `fr` et `ar` sont extraites (consigne). Les locales planifiées `en, nl, es, de`
(`src/i18n/routing.ts` → `plannedLocales`) devront être traduites intégralement le moment venu — chacune
sur la base des **401** clés fr. Les catalogues en/nl/es/de du prototype sont incomplets et pollués
(nl ~209 clés, es/de ~352) : **ne pas les reprendre** ; repartir du fr consolidé de `messages/fr.json`.
