---
name: ingest-batch
description: >
  Ingère plusieurs transcripts PaduTeam liés à un même sujet via un fichier de suivi d'ingestion
  (ex: FEMINISME.md, GAZA.md). Chaque vidéo est confiée à un subagent dédié pour préserver la
  finesse analytique du transcript — pas de compaction multi-vidéos. Un dernier subagent consolide
  les Enjeux à partir des fiches vidéo produites (pas des transcripts). Déclencher quand
  l'utilisateur dit "ingérer le batch X de FEMINISME.md", "ingère le prochain batch de GAZA.md",
  "batch ingest", ou fournit explicitement un fichier de suivi pointant vers un sous-batch non
  réalisé.
date created: Monday, April 13th 2026, 12:00:00 pm
date modified: Monday, April 20th 2026, 1:27:51 pm
skill_version: ingest-batch-2026-04-19
---

# Skill : Ingestion Batch par sujet

## Vue d'ensemble

Cette skill ingère **plusieurs transcripts liés à un même sujet** via un fichier de suivi. Elle existe parce qu'ingérer N transcripts dans un même contexte **fait perdre la substance analytique** : quand un agent lit 6 transcripts puis écrit les fiches, la compaction efface les données chiffrées, les théorisations, les formulations marquantes — il ne reste que l'ossature narrative.

**Principe fondamental : pas de compaction multi-vidéos.** Chaque transcript est lu par un **subagent dédié** qui produit dans la foulée la fiche vidéo et les fiches Concepts/Individus/Organisations associées, pendant que le transcript est encore entier dans sa fenêtre de contexte. Seuls les Enjeux sont consolidés en fin de batch, par un subagent final qui lit les **fiches vidéo produites** (pas les transcripts) — à cette granularité, on voit les récurrences cross-vidéos sans noyer les détails.

**Conventions partagées** (nommage, wikilinks, frontmatter, taxonomie, style, git) : voir `BUILD.md`.

**Skills appelées (par les subagents) :**
- `gather-context` — état actuel du vault sur le sujet (une fois, en amont)
- `write-video` — fiche vidéo (appelée par chaque subagent vidéo)
- `write-entity` — individus et organisations (appelée par chaque subagent vidéo)
- `write-concept` — concepts analytiques (appelée par chaque subagent vidéo)
- `write-enjeu` — enjeux stratégiques (appelée par le subagent final de consolidation)

**Différences clés avec `ingest-video` (ingestion unitaire) :**
- Entrée : un **fichier de suivi** pointant vers un sous-batch (pas de sélection automatique ni de sujet libre)
- Un subagent dédié par vidéo → préserve la finesse analytique du transcript
- Un subagent final de consolidation pour les Enjeux à partir des fiches vidéo
- Un seul commit pour tout le batch, **directement sur `develop`**
- Ordre chronologique pour que les subagents ultérieurs voient les fiches Concepts/Entités déjà enrichies par les précédents

---

## Entrée

**Unique mode d'entrée : un fichier de suivi d'ingestion** (ex: `FEMINISME.md`, `GAZA.md`). Le fichier liste plusieurs sous-batches thématiques avec statut (`⏳ en attente`, `✅ fait`, etc.) et liste de vidéos cochables.

La skill prend **le premier batch non réalisé** dans l'ordre du fichier (ou l'ordre recommandé s'il est spécifié en fin de fichier), **sauf si l'utilisateur désigne explicitement un batch** (ex: « fais le batch C de FEMINISME.md »).

Si l'utilisateur fournit autre chose (un sujet, une liste de vidéos, un bloc temporel) sans fichier de suivi, **demander qu'un fichier de suivi soit créé ou désigné d'abord** — cette skill ne travaille qu'à partir d'un fichier de suivi existant. Pour une vidéo isolée, orienter vers `ingest-video`.

**Note worktree** : cette skill n'a **pas besoin** d'être lancée dans un worktree git. Elle travaille directement sur `develop` dans le répertoire principal. Ne pas créer de worktree pour l'exécuter.

---

## Workflow

### Étape 1 — Identifier le périmètre du batch

1. Lire le fichier de suivi en entier.
2. Identifier les sous-batches et leur statut. Chaque batch a typiquement un titre (`## Batch A — ...`), un **Statut** et une liste de vidéos (`- [ ]` / `- [x]`).
3. **Si l'utilisateur a désigné un batch explicitement** (ex. « batch C »), prendre celui-là.
4. **Sinon**, prendre le **premier batch non réalisé** dans l'ordre du fichier (ou dans l'ordre recommandé si la section « Notes et décisions » en définit un).
5. Résoudre chaque vidéo cochable (`- [ ]`) du batch au transcript correspondant dans `Sources/Transcripts/` par correspondance fuzzy sur le basename (normalisation : minuscules, suppression des accents, ponctuation → espaces, compactage des espaces). Si aucune correspondance n'est trouvée pour une vidéo, signaler à l'utilisateur avant de continuer.
6. **Présenter la liste** à l'utilisateur pour validation avant de continuer — **sauf si le prompt contient "mode automatique"**, auquel cas procéder directement sans attendre de confirmation.

### Étape 2 — État du vault (gather-context)

Appeler `gather-context` avec le sujet du batch (dérivé du titre du sous-batch + thème parent). Cela produit `Sources/.context-tmp.md` — une **carte de navigation** : une présentation synthétique du sujet + une liste annotée de fiches liées (Enjeux, Concepts, Individus, Organisations, Vidéos déjà ingérées).

Ce fichier est **passé tel quel** à chaque subagent vidéo et au subagent final de consolidation. Les subagents sont responsables d'ouvrir les fiches wikilinkées dont ils ont besoin — la carte liste, elle ne recopie pas le contenu. C'est explicité dans les briefings ci-dessous.

### Étape 3 — Mettre develop à jour

1. `git fetch origin`
2. Se positionner sur `develop` à jour : `git checkout develop && git pull origin develop`

Le travail se fait directement sur `develop` — pas de branche dédiée.

### Étape 4 — Résoudre l'ordre de lancement

Les subagents vidéo sont lancés **séquentiellement dans l'ordre des vidéos tel qu'il apparaît dans le fichier de suivi**. Par convention, les fichiers de suivi listent les vidéos d'un sous-batch en ordre chronologique (ancien → récent) — c'est cette convention qui fixe l'ordre, pas une source externe.

La séquentialité permet :
- que les fiches Concepts/Individus/Organisations reflètent l'évolution temporelle
- que chaque subagent voie les enrichissements produits par les précédents (et puisse wikilinker vers des fiches déjà existantes plutôt que créer des doublons)

Si une vidéo du batch n'a pas de date connue à ce stade (cas rare, ex: transcript sans métadonnée), le subagent de cette vidéo lira la date dans son transcript et l'inscrira dans la fiche vidéo qu'il produit — ce n'est pas un blocage pour l'ordre de lancement.

### Étape 5 — Un subagent par vidéo (séquentiel, ordre chronologique)

Pour **chaque vidéo** du batch, dans l'ordre chronologique, lancer un subagent via l'outil `Agent` (subagent_type: `general-purpose`). Attendre la fin de chaque subagent avant de lancer le suivant — ne **jamais** lancer ces subagents en parallèle (conflits sur les fiches partagées Concepts/Individus/Organisations).

**Mission à spécifier dans le prompt du subagent :**
- Lire en entier **un seul transcript** (celui de la vidéo assignée) — le transcript doit rester intégralement dans son contexte pendant toute la rédaction
- Produire la fiche vidéo via la skill `write-video`
- Créer ou enrichir les fiches Individus/Organisations mentionnés en appelant `write-entity` par entité
- Créer ou enrichir les fiches Concepts mobilisés en appelant `write-concept` par concept
- **Ne jamais toucher aux fiches Enjeux** (dossier `Enjeux/`) — ce sera le rôle du subagent final
- Ne pas committer, ne pas pusher, **ne pas créer de branche git**, ne pas modifier l'Inventaire ni le fichier de suivi — se limiter aux fichiers dans `Videos/`, `Individus/`, `Organisations/`, `Concepts/`

**Contenu du briefing à transmettre au subagent :**
- Chemin du transcript à lire (unique)
- Titre, date et youtube_id de la vidéo
- Contenu de `Sources/.context-tmp.md` — **carte de navigation**, pas dump de contenu. Le subagent doit **ouvrir lui-même** les fiches wikilinkées dont il a besoin (Concepts liés pour les formulations d'outils analytiques, fiches Individus/Organisations existantes pour éviter les doublons, etc.)
- Liste des autres vidéos du batch (titre + date uniquement) pour wikilinks possibles entre fiches vidéo du sous-batch
- Pointeurs vers `CLAUDE.md`, `BUILD.md`, et les CLAUDE.md locaux (`Videos/CLAUDE.md`, etc.) qui définissent conventions, frontmatter, taxonomie
- **Exigences de finesse analytique** (contre-mesure à la compaction observée) :
  - Au moins 2-3 données chiffrées significatives du transcript intégrées à la fiche vidéo
  - Au moins 1 thèse théorique explicitement formulée (pas seulement nommée via wikilink)
  - Formulations marquantes citées littéralement avec timestamp quand pertinent
  - Si la vidéo articule un mécanisme (matérialiste, sociologique, politique), le restituer avec ses étapes — pas juste le nommer
- **Interdit absolu de référencer le « batch »** dans les fiches produites (cf. Règles)

Si un subagent échoue ou produit un résultat manifestement incomplet, analyser la cause et le relancer — ne pas passer à la vidéo suivante avec un état incohérent. Entre deux lancements, rappeler à l'orchestrateur (soi-même) qu'il ne doit **pas** lire les transcripts lui-même : la valeur de cette architecture tient à l'isolation de contexte par vidéo.

### Étape 6 — Subagent final : consolidation des Enjeux

Une fois **toutes** les fiches vidéo du batch écrites, lancer un dernier subagent via `Agent` (subagent_type: `general-purpose`).

**Mission à spécifier dans le prompt du subagent :**
- Lire **uniquement les fiches vidéo produites par le batch** (lister les chemins), **pas les transcripts bruts**
- Lire `Sources/.context-tmp.md` (carte de navigation) puis **ouvrir les fiches Enjeux existantes listées** pour enrichir plutôt que doublonner
- Identifier les enjeux stratégiques PaduTeam touchés par le corpus : récurrences entre vidéos, nouveaux arguments, évolutions temporelles, contradictions internes
- Pour chaque enjeu identifié, appeler `write-enjeu` **une seule fois** avec la vue d'ensemble du corpus
- Ne pas committer

**Pourquoi lire les fiches vidéo et pas les transcripts** : la granularité « fiche vidéo » a déjà extrait les thèses et données matérielles à l'étape 5. Le subagent final peut donc voir les récurrences cross-vidéos sans que son contexte soit saturé par 6 transcripts bruts — ce qui recréerait exactement le problème de compaction que cette architecture évite.

**Contenu du briefing à transmettre :**
- Liste des chemins des fiches vidéo du batch
- Liste des fiches Enjeux existantes à considérer pour enrichissement
- Rappel : un Enjeu existe parce qu'il est un **combat stratégique récurrent** de la PaduTeam, pas un simple thème. Ne pas créer de fiche Enjeu pour un sujet isolé d'une seule vidéo.
- **Interdit absolu de référencer le « batch »** dans les fiches produites

### Étape 7 — Vérification liens orphelins

Parcourir les fiches créées/modifiées, vérifier que chaque `[[wikilink]]` pointe vers un fichier existant. Créer des ébauches pour les liens restants.

### Étape 8 — Vérification orthographique

Passe unique sur toutes les fiches du batch.

### Étape 9 — Mise à jour du fichier de suivi

Dans le fichier de suivi (ex. `FEMINISME.md`) : cocher chaque vidéo ingérée (`- [ ]` → `- [x]`) et mettre à jour le **Statut** du sous-batch (`⏳ en attente` → `✅ fait` ou équivalent). Ajouter éventuellement une note courte sur ce qui est sorti du batch (ex. fiches créées majeures).

**Note sur l'Inventaire** : `Sources/Inventaire PaduTeam.md` est une vue DataviewJS dynamique — l'appariement transcript ↔ fiche vidéo se fait automatiquement (via `youtube_id`, wikilink ou nom normalisé). Aucune édition manuelle n'y est nécessaire ; s'assurer seulement que chaque fiche vidéo créée porte bien son `youtube_id` dans le frontmatter (ce qui est déjà la forme par défaut produite par `write-video`).

### Étape 10 — Commit direct sur develop

**Un seul commit pour tout le batch**, directement sur `develop` :

```
ingest-batch: {SUJET} ({N} vidéos)

Vidéos ingérées:
- {Titre 1}
- {Titre 2}
- ...

Fiches créées: X (liste)
Fiches enrichies: Y (liste)
Enjeux consolidés: Z (liste)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

1. `git add` fichier par fichier (pas `-A`).
2. Commit avec le message ci-dessus sur `develop`.
3. Push : `git push origin develop`.

### Étape 11 — Résumé à l'utilisateur

Présenter :
- Nombre de vidéos ingérées et cohérence temporelle du batch
- Enjeux créés/enrichis par le subagent final, avec la rationalité (pourquoi ces enjeux et pas d'autres)
- Nombre de fiches créées vs enrichies par catégorie
- Confirmation que `develop` est à jour (commit poussé)

---

## Règles

- **Pas de compaction multi-vidéos.** L'orchestrateur (qui exécute cette skill) ne lit **jamais** de transcript lui-même. Chaque transcript est lu dans un subagent dédié. Si l'orchestrateur se retrouve à lire 2 transcripts dans la même conversation, c'est un bug d'architecture — relancer en subagents séparés.
- **Les Enjeux sont consolidés, jamais enrichis incrémentalement.** Un seul appel `write-enjeu` par enjeu, par le subagent final, à partir des fiches vidéo. Si un subagent vidéo tente d'écrire ou enrichir un Enjeu, c'est un bug.
- **Le subagent final ne lit pas les transcripts.** Sa valeur tient précisément à travailler à la granularité « fiche vidéo » — sinon on recrée le problème de compaction initial.
- **Ordre chronologique et séquentiel.** Les subagents vidéo sont lancés un par un, dans l'ordre chronologique, pour que l'évolution temporelle soit lisible et que chaque subagent voie les enrichissements précédents. Jamais en parallèle (conflits sur fiches partagées).
- **Un seul commit sur develop.** Même si le batch couvre 10 vidéos, il produit 1 commit direct sur `develop` (pas de branche, pas de merge).
- **Taille du batch.** Minimum 2 vidéos. Moins de 2, utiliser `ingest-video`. Pas de limite supérieure — chaque transcript étant lu par un subagent dédié, la taille du batch n'affecte pas la qualité d'analyse.
- **Fichier de suivi obligatoire.** Cette skill ne travaille pas à partir d'un sujet libre, d'une liste ad-hoc ou d'un bloc temporel. Si l'utilisateur n'en a pas, lui demander d'en créer un (ou utiliser `ingest-video` pour une seule vidéo).
- **Ne jamais référencer le « batch » dans les fiches.** Le découpage en batches est un artefact du workflow d'ingestion — les lecteurs des fiches (Concepts, Enjeux, Individus, Organisations, Vidéos) n'ont pas accès à cette information et ne peuvent pas comprendre des formulations comme « batch D », « ce batch », « le corpus batch », « cf. batch F », « apports du batch X ». Reformuler en nommant le sujet réel (« l'arc Rima Hassan », « le corpus Gaza », « les vidéos sur le sionisme de gauche », ou simplement supprimer la référence). Cette règle ne s'applique pas aux fichiers de suivi d'ingestion (ex: `GAZA.md`, `FEMINISME.md`) qui sont explicitement des fichiers de travail.

---

## Feedback système

À la fin du batch, évaluer si les subagents ont révélé des éléments qui devraient mettre à jour le système :
- Un thème ou un enjeu qui mérite d'entrer dans la taxonomie de `BUILD.md` ?
- Un concept structurant qui mériterait d'être mentionné dans `CLAUDE.md` ?
- Une contradiction récurrente entre vidéos qui suggère que la position PaduTeam a évolué et que les fiches anciennes doivent être révisées ?
- Les exigences de finesse (Étape 5) ont-elles été respectées par tous les subagents vidéo ? Si un subagent a produit une fiche appauvrie malgré la consigne, le signaler pour raffiner le briefing des prochains batchs.

Signaler à l'utilisateur sans modifier automatiquement.
