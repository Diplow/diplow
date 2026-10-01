---
name: ingest-video
description: >
  Orchestre l'ingestion d'un transcript de vidéo PaduTeam dans la base de connaissances Obsidian.
  Coordonne les skills spécialisées : gather-context pour la recherche, puis write-video,
  write-entity, write-concept et write-enjeu pour la rédaction des fiches.
  Gère aussi le commit git (direct sur develop), la vérification ortho et les liens orphelins.
  Déclencher quand l'utilisateur dit "ingérer", "ajouter au vault", "créer les fiches",
  "analyser cette vidéo pour Obsidian", ou toute demande combinant un transcript PaduTeam et la base de connaissances.
date created: Tuesday, March 31st 2026, 10:29:39 am
date modified: Monday, April 20th 2026, 1:27:51 pm
skill_version: ingest-video-2026-04-19
---

# Skill : Ingestion PaduTeam → Knowledge Vault (orchestrateur)

## Vue d'ensemble

Cette skill orchestre l'ingestion d'un transcript de vidéo PaduTeam. Elle ne rédige pas directement les fiches — elle coordonne les skills spécialisées qui le font.

**Conventions partagées** (nommage, wikilinks, frontmatter, taxonomie, style, git) : voir `BUILD.md`.

**Skills appelées :**
- `gather-context` — rassemble le contexte vault sur les sujets de la vidéo
- `write-video` — rédige la fiche vidéo
- `write-entity` — rédige/enrichit les fiches individus et organisations
- `write-concept` — rédige/enrichit les fiches concepts
- `write-enjeu` — rédige/enrichit les fiches enjeux

---

## Workflow

### Étape 1 — Sélection de la vidéo

Si l'utilisateur ne fournit ni URL, ni titre, ni transcript :

1. Lister les fichiers de `Sources/Transcripts/` (ignorer ceux préfixés par `_`)
2. Lister les fichiers de `Videos/`
3. Identifier les transcripts **sans fiche vidéo correspondante**. Le matching peut se faire par `youtube_id` (champ présent dans le frontmatter du transcript, à croiser avec le frontmatter des fiches vidéo) ou, à défaut, par nom de fichier normalisé (minuscules, sans accents, ponctuation → espaces).
4. Parmi ces transcripts « orphelins », proposer à l'utilisateur le plus récent (par date de modification du fichier transcript, ou par date YouTube si disponible dans le frontmatter) et demander confirmation avant de continuer.
5. Si tous les transcripts ont une fiche, le signaler.

**Note** : `Sources/Inventaire PaduTeam.md` est une vue DataviewJS dynamique — elle calcule ce croisement transcript ↔ fiche à la volée dans Obsidian, elle n'est pas lisible depuis le système de fichiers. C'est la raison pour laquelle on refait le croisement directement ici.

### Étape 2 — Mettre develop à jour

1. `git checkout develop && git pull origin develop`

Le travail se fait directement sur `develop` — pas de branche dédiée.

### Étape 3 — Lire le transcript

**Toujours chercher dans le vault d'abord** (`Sources/Transcripts/`), avant toute extraction YouTube.

1. Chercher un fichier correspondant au titre (correspondance partielle)
2. Si trouvé → lire directement
3. Si non trouvé → extraire via `paduteam-transcript`, sauvegarder dans `Sources/Transcripts/`

Lire le transcript en entier.

### Étape 4 — Analyser le contenu

Identifier à partir du transcript :

1. **Métadonnées** : titre, date, domaine, `youtube_id` (récupérer directement dans le frontmatter du transcript — le champ `youtube_id` y est présent)
2. **Individus** mentionnés significativement
3. **Organisations** mentionnées
4. **Concepts analytiques** utilisés
5. **Enjeux stratégiques** avancés par cette vidéo
6. **Thèses principales** : résumé, projections, mécanismes cause-conséquence

### Étape 5 — Gather context

Appeler `gather-context` avec les sujets principaux de la vidéo (thèmes, enjeux, concepts clés identifiés à l'étape 4).

Le fichier produit `Sources/.context-tmp.md` est une **carte de navigation** : une présentation synthétique du sujet et une liste de fiches liées à ouvrir. Les skills `write-*` qui suivent consomment ce fichier et ouvrent elles-mêmes les fiches wikilinkées dont elles ont besoin pour écrire.

### Étape 6 — Lire les fiches existantes

```bash
ls Individus/ && ls Organisations/ && ls Concepts/ && ls Videos/ && ls Enjeux/
```

Pour chaque entité identifiée à l'étape 4, déterminer si la fiche existe ou non.

### Étape 7 — Rédiger les fiches

Appeler les skills spécialisées dans cet ordre :

1. **`write-video`** — Créer la fiche vidéo. Entrée : transcript analysé + contexte.

2. **`write-entity`** — Pour chaque individu et organisation mentionné significativement. Entrée : ce que le transcript dit de l'entité + fiche existante (si applicable) + contexte.

3. **`write-concept`** — Pour chaque concept analytique identifié. Entrée : ce que le transcript dit du concept + fiche existante + contexte.

4. **`write-enjeu`** — Pour chaque enjeu stratégique avancé par la vidéo. Entrée : ce que le transcript apporte à l'enjeu + fiche existante + contexte. **Note** : write-enjeu bénéficie particulièrement du contexte multi-vidéos — c'est la skill qui produit le plus de valeur ajoutée par rapport à l'ancien workflow monolithique.

### Étape 8 — Vérification des liens orphelins

Vérifier que chaque `[[wikilink]]` dans les fiches créées/modifiées pointe vers un fichier existant. Si des liens orphelins restent, créer les fiches manquantes (même minimales via `write-entity` ou `write-concept`).

### Étape 9 — Vérification orthographique des noms

Les transcripts auto-générés produisent des erreurs sur les noms propres :

1. **Repérer** les noms douteux (transcription phonétique, incohérences, noms peu connus)
2. **Croiser avec le vault** : si une fiche existe avec une orthographe différente, utiliser celle du vault
3. **Vérifier par recherche web** les noms qui restent douteux
4. **Corriger** : renommer fichiers + mettre à jour wikilinks et contenu
5. **Rapporter** les corrections (nom erroné → nom corrigé)

Se concentrer sur les noms étrangers et les personnalités secondaires.

### Étape 10 — Vérifier l'appariement dans l'Inventaire

`Sources/Inventaire PaduTeam.md` est une vue DataviewJS qui apparie automatiquement transcripts et fiches vidéo (priorité : `youtube_id`, puis wikilink vers le transcript, puis nom normalisé). **Il n'y a donc rien à éditer manuellement**. Vérifier simplement que la fiche vidéo créée porte au moins l'un de ces ancrages pour que l'appariement se fasse :
- `youtube_id` dans le frontmatter (forme recommandée — déjà prévue par `write-video`)
- ou un `[[wikilink]]` vers le transcript dans le corps de la fiche
- ou un nom de fichier proche (normalisé) du nom du transcript

### Étape 11 — Commit direct sur develop

Suivre le workflow git défini dans `BUILD.md` — commit direct sur `develop`, pas de branche :

1. `git status` pour lister les fichiers modifiés
2. `git add` par nom (pas `-A`)
3. Commit structuré sur `develop` :
   ```
   ingest: TITRE ABRÉGÉ DE LA VIDÉO

   Fiches créées: X (liste)
   Fiches enrichies: Y (liste)
   Corrections ortho: Z (liste si applicable)

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```
4. `git push origin develop`

### Étape 12 — Résumé à l'utilisateur

Présenter :
- Nombre de fiches créées vs enrichies
- Liste des nouvelles fiches par catégorie
- Fiches existantes enrichies
- Liens orphelins restants (normalement 0)
- Enjeux identifiés ou enrichis
- Corrections orthographiques (nom erroné → nom corrigé)
- **Lien vers la PR** pour review

---

## Feedback système

À la fin de chaque ingestion, évaluer si le transcript a révélé quelque chose qui devrait mettre à jour le système :
- Nouveau thème récurrent non couvert par la taxonomie ?
- Nouveau concept analytique qui mériterait d'être dans `CLAUDE.md` ?
- Nouvel enjeu à ajouter au vocabulaire contrôlé ?
- Correction à apporter aux conventions de `BUILD.md` ?

Si oui, le signaler à l'utilisateur dans le résumé (pas de modification automatique — l'utilisateur décide).
