# 00 — Cartographie des blocs

Établie par localisation (`grep`) des balises structurantes, confirmée ensuite par lecture intégrale.
Note : les balises `<script>`/`<style>` apparaissant dans les lignes 4896-5233 (démo) et 4942-5233 (connecté) sont des **chaînes JavaScript** (templates d'impression de reçus / bilan), pas de vraies balises. Elles sont incluses dans le bloc `<script>` principal.

## index-demo.html — 5944 lignes, 464 186 octets

| Plage | Bloc | Contenu attendu |
|-------|------|-----------------|
| 1-9 | `<head>` début | DOCTYPE, `<html lang="fr">`, meta |
| 10-32 | `<script>` #1 | script précoce (config / i18n init) |
| 33-181 | `<style>` #1 | CSS bloc 1 |
| 182-545 | `<style>` #2 | CSS bloc 2 |
| 546 | `</head>` | |
| 547-1186 | `<body>` HTML | structure des écrans (markup statique) |
| 1187-5886 | `<script>` principal | logique applicative (contient templates d'impression 4896-5198 en chaînes) |
| 5887-5943 | fin de body | markup résiduel + `</body>` |

## index-connecte.html — 6787 lignes, 495 004 octets

| Plage | Bloc | Contenu attendu |
|-------|------|-----------------|
| 1-7 | `<head>` début | DOCTYPE, `<html lang="fr">`, meta |
| 8 | `<script src>` | CDN `@supabase/supabase-js@2` |
| 9-25 | `<script>` #1 | config Supabase (URL/clé) |
| 29-51 | `<script>` #2 | script complémentaire |
| 52-200 | `<style>` #1 | CSS bloc 1 |
| 201-532 | `<style>` #2 | CSS bloc 2 |
| 533 | `</head>` | |
| 534-1250 | `<body>` HTML | structure des écrans (markup statique) |
| 1251-6729 | `<script>` principal | logique applicative + Supabase (templates 4942-5233 en chaînes) |
| 6730-6786 | fin de body | markup résiduel + `</body>` |

## Périmètre de lecture
Total à lire : 12 731 lignes (5944 + 6787). Aucune plage exclue.
