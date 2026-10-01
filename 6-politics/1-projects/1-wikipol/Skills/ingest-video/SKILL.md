---
name: ingest-video
description: >
  Orchestre l'ingestion d'un transcript de vidéo dans la base de connaissances Obsidian d'une source
  WikiPol. Coordonne les skills spécialisées : gather-context pour la recherche, puis write-video,
  write-entity, write-concept et write-enjeu pour la rédaction des fiches.
  Gère aussi le workflow git (branche, commit, PR), la vérification ortho et les liens orphelins.
  Déclencher quand l'utilisateur dit "ingérer", "ajouter au vault", "créer les fiches",
  "analyser cette vidéo pour Obsidian", ou toute demande combinant un transcript et la base de connaissances.
date created: Tuesday, March 31st 2026, 10:29:39 am
date modified: 2026-04-20
skill_version: ingest-video-2026-04-20
---

# Skill : Ingestion Vidéo → Knowledge Vault (orchestrateur)

## Vue d'ensemble

Cette skill orchestre l'ingestion d'un transcript de vidéo dans le vault d'une source WikiPol. Elle ne rédige pas directement les fiches — elle coordonne les skills spécialisées qui le font.

**Conventions partagées** (nommage, wikilinks, frontmatter, git) : voir `BUILD.md` à la racine de WikiPol.
**Contexte éditorial de la source** (ton, principes, pièges, attribution) : voir `CLAUDE.md` de la source courante.
**Taxonomie de la source** (domaines, thèmes, enjeux) : voir `BUILD.md` de la source courante.

**Skills appelées (selon les `content_types` activés dans `source.yaml`) :**
- `gather-context` — rassemble le contexte vault sur les sujets de la vidéo
- `write-video` — rédige la fiche vidéo (cas standard, basic)
- `write-book` — rédige une fiche Livres/ à la place de la fiche vidéo, pour les chroniques d'ouvrage (basic, optionnel)
- `write-entity` — rédige/enrichit les fiches individus et organisations (basic)
- `write-concept` — rédige/enrichit les fiches concepts (basic)
- `write-evenement` — rédige/enrichit une fiche événement quand le transcript analyse un fait daté singulier (basic, optionnel)
- `write-enjeu` — rédige/enrichit les fiches enjeux (advanced)
- `write-conjoncture` — rédige/enrichit une fiche conjoncture quand un transcript révise un diagnostic du moment (advanced, optionnel)
- `write-possible` — rédige/enrichit une fiche possible quand un transcript articule un scénario alternatif (advanced, optionnel)
- `write-methode` — rédige/enrichit une fiche méthode quand un transcript explicite une procédure analytique (advanced, optionnel)

Avant d'invoquer une skill `write-*`, vérifier que son type est activé dans `source.yaml:content_types` via `cfg.content_type_enabled("Evenements")` (ou le type concerné). Une skill invoquée pour un type désactivé doit interrompre et signaler.

---

## Workflow

### Étape 1 — Sélection de la vidéo

Si l'utilisateur ne fournit ni URL, ni titre, ni transcript :

1. Lister les fichiers de `Sources/Transcripts/` (ignorer ceux préfixés par `_`)
2. Lister les fichiers de `Videos/`
3. Identifier les transcripts **sans fiche vidéo correspondante**. Le matching peut se faire par `youtube_id` (champ présent dans le frontmatter du transcript, à croiser avec le frontmatter des fiches vidéo) ou, à défaut, par nom de fichier normalisé (minuscules, sans accents, ponctuation → espaces).
4. Parmi ces transcripts « orphelins », proposer à l'utilisateur le plus récent (par date de modification du fichier transcript, ou par date de publication si disponible dans le frontmatter) et demander confirmation avant de continuer.
5. Si tous les transcripts ont une fiche, le signaler.

**Note** : `Sources/Inventaire.md` est une vue DataviewJS dynamique — elle calcule ce croisement transcript ↔ fiche à la volée dans Obsidian, elle n'est pas lisible depuis le système de fichiers. C'est la raison pour laquelle on refait le croisement directement ici.

### Étape 2 — Branche git

1. Générer le slug depuis le titre (minuscules, sans accents, tirets, ~50 chars max)
2. `git checkout develop && git pull origin develop`
3. `git checkout -b ingest/<slug>`

### Étape 3 — Lire le transcript

**Toujours chercher dans le vault d'abord** (`Sources/Transcripts/`), avant toute extraction YouTube.

1. Chercher un fichier correspondant au titre (correspondance partielle)
2. Si trouvé → lire directement
3. Si non trouvé → extraire via `Scripts/batch_transcripts.py --source <chemin-source> --recent N`, le transcript sera placé dans `Sources/Transcripts/`

Lire le transcript en entier.

### Étape 4 — Analyser le contenu et choisir le type de fiche-pivot

Identifier à partir du transcript :

1. **Métadonnées** : titre, date, domaine, `youtube_id` (récupérer directement dans le frontmatter du transcript — le champ `youtube_id` y est présent)
2. **Individus** mentionnés significativement
3. **Organisations** mentionnées
4. **Concepts analytiques** utilisés
5. **Enjeux stratégiques** avancés par cette vidéo
6. **Thèses principales** : résumé, projections, mécanismes cause-conséquence

**Choix du type de fiche-pivot** :

- **Fiche Vidéo (cas standard)** — par défaut pour toute vidéo d'analyse, de commentaire, d'actualité.
- **Fiche Livre** — quand le transcript est majoritairement consacré à la restitution et à l'appréciation d'un ouvrage unique (format « J'ai lu X de Y », chronique de livre, notes de lecture).

Heuristiques de détection *fiche Livre* :
- Titre de la vidéo contient des mots-clés comme « J'ai lu », « Lecture », « Notes de lecture », « Chronique de », « Le livre de », « À propos du livre »
- Transcript présente un ouvrage identifié (auteur + titre) et en discute principalement
- La source donne une appréciation explicite du livre

En cas de doute, privilégier la fiche Vidéo. Si plus tard la fiche gagnerait à être indexée par l'ouvrage, elle peut être convertie (renommage + adaptation du frontmatter).

### Étape 5 — Gather context

Appeler `gather-context` avec les sujets principaux de la vidéo (thèmes, enjeux, concepts clés identifiés à l'étape 4).

Le fichier produit `Sources/.context-tmp.md` est une **carte de navigation**. Les skills `write-*` qui suivent consomment ce fichier et ouvrent elles-mêmes les fiches wikilinkées dont elles ont besoin pour écrire.

### Étape 6 — Lire les fiches existantes

```bash
ls Individus/ && ls Organisations/ && ls Concepts/ && ls Videos/ && ls Enjeux/
```

Pour chaque entité identifiée à l'étape 4, déterminer si la fiche existe ou non.

### Étape 7 — Rédiger les fiches

Appeler les skills spécialisées dans cet ordre. Avant chaque appel, vérifier que le type est activé dans `source.yaml:content_types` (cf. `cfg.content_type_enabled(...)` ; sauter si désactivé).

**Basics** (créés à partir de ce que dit le transcript) :

1. **Fiche-pivot** — Créer la fiche pivot selon le type choisi à l'étape 4 :
   - Cas standard → **`write-video`** (fiche `Videos/`)
   - Chronique d'ouvrage → **`write-book`** (fiche `Livres/` — l'embed YouTube et le lien transcript vivent ici, pas de fiche Videos/ pour cette vidéo). Requiert `Livres` activé.
2. **`write-entity`** — Pour chaque individu et organisation mentionné significativement. Pour une chronique livre, **toujours** créer/enrichir la fiche Individu de l'auteur du livre.
3. **`write-concept`** — Pour chaque concept analytique identifié.
4. **`write-evenement`** — Si le transcript analyse en profondeur un événement daté singulier (≥1-2 minutes ou élément central de la vidéo). Requiert `Evenements` activé. Seuil moyen : préférer un wikilink dans la fiche-pivot à une fiche Evenement vide.

**Advanced** (synthèse à partir de fiches existantes — appeler seulement quand le transcript courant fournit matière à *réviser* la fiche advanced, pas par défaut) :

5. **`write-enjeu`** — Pour chaque enjeu stratégique avancé par la vidéo. **Note** : write-enjeu bénéficie particulièrement du contexte multi-vidéos ; si la vidéo n'apporte pas de nouvel argument à un Enjeu existant, ne pas l'appeler.
6. **`write-conjoncture`** — Seulement si le transcript reformule, confirme ou révise significativement un diagnostic du moment historique. Requiert `Conjonctures` activé.
7. **`write-possible`** — Seulement si le transcript articule explicitement un scénario alternatif (avec acteurs, mécanismes, conditions). Requiert `Possibles` activé.
8. **`write-methode`** — Seulement si le transcript explicite ou raffine une procédure analytique (étapes décomposables). Requiert `Methodes` activé.

Pour les types advanced, en mode batch (`ingest-batch`), réserver les appels au subagent final de consolidation — pas au subagent vidéo.

### Étape 8 — Vérification des liens orphelins

Vérifier que chaque `[[wikilink]]` dans les fiches créées/modifiées pointe vers un fichier existant. Si des liens orphelins restent, créer les fiches manquantes (même minimales).

### Étape 9 — Vérification orthographique des noms

Les transcripts auto-générés produisent des erreurs sur les noms propres :

1. **Repérer** les noms douteux (transcription phonétique, incohérences, noms peu connus)
2. **Croiser avec le vault** : si une fiche existe avec une orthographe différente, utiliser celle du vault
3. **Vérifier par recherche web** les noms qui restent douteux
4. **Corriger** : renommer fichiers + mettre à jour wikilinks et contenu
5. **Rapporter** les corrections

Se concentrer sur les noms étrangers et les personnalités secondaires.

### Étape 10 — Vérifier l'appariement dans l'Inventaire

`Sources/Inventaire.md` est une vue DataviewJS qui apparie automatiquement transcripts et fiches vidéo (priorité : `youtube_id`, puis wikilink vers le transcript, puis nom normalisé). **Il n'y a donc rien à éditer manuellement**. Vérifier simplement que la fiche vidéo créée porte au moins l'un de ces ancrages :
- `youtube_id` dans le frontmatter (forme recommandée — déjà prévue par `write-video`)
- ou un `[[wikilink]]` vers le transcript dans le corps de la fiche
- ou un nom de fichier proche (normalisé) du nom du transcript

### Étape 11 — Commit, push et PR

Suivre le workflow git défini dans `BUILD.md` de WikiPol :

1. `git status` pour lister les fichiers modifiés
2. `git add` par nom (pas `-A`)
3. Commit structuré :
   ```
   ingest: TITRE ABRÉGÉ DE LA VIDÉO

   Fiches créées: X (liste)
   Fiches enrichies: Y (liste)
   Corrections ortho: Z (liste si applicable)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
4. `git push -u origin ingest/<slug>`
5. PR vers `develop` avec résumé d'ingestion

### Étape 12 — Résumé à l'utilisateur

Présenter :
- Nombre de fiches créées vs enrichies
- Liste des nouvelles fiches par catégorie
- Fiches existantes enrichies
- Liens orphelins restants (normalement 0)
- Enjeux identifiés ou enrichis
- Corrections orthographiques
- **Lien vers la PR** pour review

---

## Feedback système

À la fin de chaque ingestion, évaluer si le transcript a révélé quelque chose qui devrait mettre à jour le système :
- Nouveau thème récurrent non couvert par la taxonomie du `BUILD.md` de la source ?
- Nouveau concept analytique qui mériterait d'être mentionné dans `CLAUDE.md` de la source ?
- Nouvel enjeu à ajouter au vocabulaire local ?
- Correction à apporter aux conventions de `BUILD.md` WikiPol (générique) ?

Si oui, le signaler à l'utilisateur dans le résumé (pas de modification automatique — l'utilisateur décide).
