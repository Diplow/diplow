---
name: ingest-batch
description: >
  Ingère plusieurs transcripts liés à un même sujet via un fichier de suivi d'ingestion
  (ex: un batch chronologique, un batch thématique). Chaque vidéo est confiée à un subagent dédié
  pour préserver la finesse analytique du transcript — pas de compaction multi-vidéos. Un dernier
  subagent consolide les fiches advanced (Enjeux, et selon activation : Conjonctures, Possibles,
  Methodes) à partir des fiches vidéo produites — pas des transcripts. Déclencher quand l'utilisateur
  dit "ingérer le batch X", "ingère le prochain batch", "batch ingest", ou fournit explicitement
  un fichier de suivi pointant vers un sous-batch non réalisé.
date created: Monday, April 13th 2026, 12:00:00 pm
date modified: 2026-04-20
skill_version: ingest-batch-2026-04-20
---

# Skill : Ingestion Batch par sujet

## Vue d'ensemble

Cette skill ingère **plusieurs transcripts liés à un même sujet** via un fichier de suivi. Elle existe parce qu'ingérer N transcripts dans un même contexte **fait perdre la substance analytique** : quand un agent lit 6 transcripts puis écrit les fiches, la compaction efface les données chiffrées, les théorisations, les formulations marquantes — il ne reste que l'ossature narrative.

**Principe fondamental : pas de compaction multi-vidéos.** Chaque transcript est lu par un **subagent dédié** qui produit dans la foulée la fiche vidéo et les fiches basics associées (Concepts, Individus, Organisations, Evenements si activés), pendant que le transcript est encore entier dans sa fenêtre de contexte. Les fiches **advanced** (Enjeux, et selon activation Conjonctures/Possibles/Methodes) sont consolidées en fin de batch, par un subagent final qui lit les **fiches vidéo produites** (pas les transcripts) — à cette granularité, on voit les récurrences cross-vidéos sans noyer les détails.

**Conventions partagées** (nommage, wikilinks, frontmatter, git) : voir `BUILD.md` de WikiPol.
**Contexte éditorial de la source** (ton, principes, attribution) : voir `CLAUDE.md` de la source.
**Taxonomie de la source** (domaines, thèmes, enjeux) : voir `BUILD.md` de la source.

**Skills appelées (par les subagents, selon les `content_types` activés dans `source.yaml`) :**
- `gather-context` — état actuel du vault sur le sujet (une fois, en amont)
- `write-video` / `write-book` — fiche-pivot par vidéo (basic, par chaque subagent vidéo)
- `write-entity` — individus et organisations (basic, par chaque subagent vidéo)
- `write-concept` — concepts analytiques (basic, par chaque subagent vidéo)
- `write-evenement` — événements datés analysés (basic, par chaque subagent vidéo si l'événement est central à la vidéo ; sinon réservé au subagent final si l'événement émerge transversalement)
- `write-enjeu` / `write-conjoncture` / `write-possible` / `write-methode` — fiches advanced (consolidation finale uniquement, pas par les subagents vidéo)

**Différences clés avec `ingest-video` :**
- Entrée : un **fichier de suivi** pointant vers un sous-batch (pas de sélection automatique ni de sujet libre)
- Un subagent dédié par vidéo → préserve la finesse analytique du transcript
- Un subagent final de consolidation pour les Enjeux à partir des fiches vidéo
- Un seul commit et une seule PR pour tout le batch
- Ordre chronologique pour que les subagents ultérieurs voient les fiches Concepts/Entités déjà enrichies par les précédents

---

## Entrée

**Unique mode d'entrée : un fichier de suivi d'ingestion** (ex: `<SLUG>_CHRONOLOGIQUE.md` généré par `Scripts/generate_chronological.py`, ou un fichier de suivi thématique écrit à la main). Le fichier liste plusieurs sous-batches thématiques avec statut (`⏳ en attente`, `✅ fait`), slug de branche, et liste de vidéos cochables.

La skill prend **le premier batch non réalisé** dans l'ordre du fichier, **sauf si l'utilisateur désigne explicitement un batch**.

Si l'utilisateur fournit autre chose (un sujet, une liste de vidéos, un bloc temporel) sans fichier de suivi, **demander qu'un fichier de suivi soit créé ou désigné d'abord** — cette skill ne travaille qu'à partir d'un fichier de suivi existant. Pour une vidéo isolée, orienter vers `ingest-video`.

**Note worktree** : cette skill n'a **pas besoin** d'être lancée dans un worktree git. Elle travaille directement dans le répertoire principal sur une branche dédiée. Ne pas créer de worktree pour l'exécuter.

---

## Workflow

### Étape 1 — Identifier le périmètre du batch

1. Lire le fichier de suivi en entier.
2. Identifier les sous-batches et leur statut. Chaque batch a typiquement un titre (`## Batch A — ...`), un **Statut**, un **Slug branche**, et une liste de vidéos (`- [ ]` / `- [x]`).
3. **Si l'utilisateur a désigné un batch explicitement**, prendre celui-là.
4. **Sinon**, prendre le **premier batch non réalisé** dans l'ordre du fichier (ou dans l'ordre recommandé si une section « Notes et décisions » en définit un).
5. Résoudre chaque vidéo cochable (`- [ ]`) du batch au transcript correspondant dans `Sources/Transcripts/` par correspondance fuzzy sur le basename (normalisation : minuscules, suppression des accents, ponctuation → espaces, compactage des espaces). Si aucune correspondance n'est trouvée pour une vidéo, signaler à l'utilisateur avant de continuer.
6. Retenir le **thème parent** (ex. le nom du fichier de suivi) — il sert à nommer la branche.
7. **Présenter la liste** à l'utilisateur pour validation avant de continuer — **sauf si le prompt contient "mode automatique"**, auquel cas procéder directement sans attendre de confirmation.

### Étape 2 — État du vault (gather-context)

Appeler `gather-context` avec le sujet du batch (dérivé du titre du sous-batch + thème parent). Cela produit `Sources/.context-tmp.md` — une **carte de navigation** : une présentation synthétique du sujet + une liste annotée de fiches liées (Enjeux, Concepts, Individus, Organisations, Vidéos déjà ingérées).

Ce fichier est **passé tel quel** à chaque subagent vidéo et au subagent final de consolidation. Les subagents sont responsables d'ouvrir les fiches wikilinkées dont ils ont besoin — la carte liste, elle ne recopie pas le contenu. C'est explicité dans les briefings ci-dessous.

### Étape 3 — Branche git

1. `git fetch origin`
2. Se positionner sur `develop` à jour : `git checkout develop && git pull origin develop`
3. Si le slug du sous-batch est déjà défini dans le fichier de suivi (champ `Slug branche`), l'utiliser tel quel. Sinon, générer un slug : minuscules, sans accents, tirets, ~40 chars max.
4. Créer la branche de travail depuis `develop` : `git checkout -b ingest-batch/<slug>`

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
- **Choisir le type de fiche-pivot** selon le contenu :
  - Cas standard → `write-video` (fiche dans `Videos/`)
  - Chronique d'ouvrage (format « J'ai lu » ou similaire) → `write-book` (fiche dans `Livres/`, remplace la fiche Vidéo). Critère : la vidéo est majoritairement consacrée à la restitution et à l'appréciation d'un ouvrage unique.
- Créer ou enrichir les fiches Individus/Organisations mentionnés en appelant `write-entity` par entité. Pour une chronique livre, toujours créer/enrichir la fiche Individu de l'auteur du livre.
- Créer ou enrichir les fiches Concepts mobilisés en appelant `write-concept` par concept
- **Ne jamais toucher aux fiches advanced** (dossiers `Enjeux/`, `Conjonctures/`, `Possibles/`, `Methodes/` — selon ce qui est activé dans la source) — ce sera le rôle du subagent final
- Ne pas committer, ne pas pusher, **ne pas créer de branche git**, ne pas modifier l'Inventaire ni le fichier de suivi — se limiter aux fichiers basics activés (typiquement `Videos/`, `Livres/`, `Individus/`, `Organisations/`, `Concepts/`, `Evenements/`)

**Contenu du briefing à transmettre au subagent :**
- Chemin du transcript à lire (unique)
- Titre, date et youtube_id de la vidéo
- Contenu de `Sources/.context-tmp.md` — carte de navigation. Le subagent doit **ouvrir lui-même** les fiches wikilinkées dont il a besoin.
- Liste des autres vidéos du batch (titre + date uniquement) pour wikilinks possibles entre fiches vidéo du sous-batch
- Pointeurs vers `BUILD.md` de WikiPol, `CLAUDE.md` et `BUILD.md` de la source
- **Exigences de finesse analytique** (contre-mesure à la compaction) :
  - Au moins 2-3 données chiffrées significatives du transcript intégrées à la fiche vidéo
  - Au moins 1 thèse théorique explicitement formulée (pas seulement nommée via wikilink)
  - Formulations marquantes citées littéralement avec timestamp quand pertinent
  - Si la vidéo articule un mécanisme, le restituer avec ses étapes — pas juste le nommer
- **Interdit absolu de référencer le « batch »** dans les fiches produites

Si un subagent échoue ou produit un résultat manifestement incomplet, analyser la cause et le relancer — ne pas passer à la vidéo suivante avec un état incohérent. Entre deux lancements, rappeler à l'orchestrateur (soi-même) qu'il ne doit **pas** lire les transcripts lui-même : la valeur de cette architecture tient à l'isolation de contexte par vidéo.

### Étape 6 — Subagent final : consolidation des fiches advanced

Une fois **toutes** les fiches vidéo (et autres basics) du batch écrites, lancer un dernier subagent via `Agent` (subagent_type: `general-purpose`). Ce subagent consolide les types **advanced** activés dans `source.yaml:content_types`.

**Mission :**
- Lire **uniquement les fiches vidéo produites par le batch** (lister les chemins), **pas les transcripts bruts**
- Lire `Sources/.context-tmp.md` puis **ouvrir les fiches advanced existantes listées** (Enjeux, et selon activation : Conjonctures, Possibles, Methodes) pour enrichir plutôt que doublonner
- Identifier les éléments advanced touchés par le corpus :
  - **Enjeux** — récurrences de combat, nouveaux arguments, évolutions temporelles, contradictions internes
  - **Conjonctures** (si activées) — diagnostics du moment révisés ou consolidés par le corpus
  - **Possibles** (si activés) — scénarios alternatifs articulés ou raffinés
  - **Methodes** (si activées) — procédures explicitées ou raffinées
- Pour chaque élément advanced identifié, appeler la skill correspondante **une seule fois** avec la vue d'ensemble du corpus
- Ne pas committer

**Pourquoi lire les fiches vidéo et pas les transcripts** : la granularité « fiche vidéo » a déjà extrait les thèses et données matérielles à l'étape 5. Le subagent final peut donc voir les récurrences cross-vidéos sans que son contexte soit saturé par des transcripts bruts — ce qui recréerait exactement le problème de compaction que cette architecture évite.

**Contenu du briefing à transmettre :**
- Liste des chemins des fiches vidéo du batch
- Liste des fiches advanced existantes à considérer pour enrichissement (par type activé)
- Liste des types advanced **activés** dans `source.yaml:content_types` — seuls ces types sont autorisés à la consolidation. Les types désactivés sont à ignorer.
- Rappels de seuil par type :
  - Enjeu : combat stratégique **récurrent** (pas un sujet isolé d'une seule vidéo).
  - Conjoncture : diagnostic du moment posé explicitement (pas une déduction).
  - Possible : scénario alternatif **articulé** par la source, avec acteurs et mécanismes.
  - Methode : procédure **décomposable en étapes**, enseignée ou systématiquement appliquée.
- **Interdit absolu de référencer le « batch »** dans les fiches produites

### Étape 7 — Vérification liens orphelins

Parcourir les fiches créées/modifiées, vérifier que chaque `[[wikilink]]` pointe vers un fichier existant. Créer des ébauches pour les liens restants.

### Étape 8 — Vérification orthographique

Passe unique sur toutes les fiches du batch.

### Étape 9 — Mise à jour du fichier de suivi

Dans le fichier de suivi : cocher chaque vidéo ingérée (`- [ ]` → `- [x]`) et mettre à jour le **Statut** du sous-batch (`⏳ en attente` → `✅ fait`). Ajouter éventuellement une note courte sur ce qui est sorti du batch.

**Note sur l'Inventaire** : `Sources/Inventaire.md` est une vue DataviewJS dynamique — l'appariement transcript ↔ fiche vidéo se fait automatiquement. Aucune édition manuelle n'y est nécessaire ; s'assurer seulement que chaque fiche vidéo créée porte bien son `youtube_id` dans le frontmatter.

### Étape 10 — Commit, merge dans develop et suppression de branche

**Un seul commit pour tout le batch :**

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

1. `git add` fichier par fichier (pas `-A`)
2. Commit avec le message ci-dessus sur la branche `ingest-batch/<slug>`
3. Merger dans `develop` :
   ```
   git checkout develop
   git pull origin develop
   git merge --no-ff ingest-batch/<slug>
   git push origin develop
   ```
4. Supprimer la branche de travail (locale et distante si elle a été poussée) :
   ```
   git branch -d ingest-batch/<slug>
   git push origin --delete ingest-batch/<slug>  # ignorer l'erreur si non poussée
   ```

### Étape 11 — Résumé à l'utilisateur

Présenter :
- Nombre de vidéos ingérées et cohérence temporelle du batch
- Enjeux créés/enrichis par le subagent final, avec la rationalité
- Nombre de fiches créées vs enrichies par catégorie
- Confirmation que `develop` est à jour et la branche supprimée

---

## Règles

- **Pas de compaction multi-vidéos.** L'orchestrateur (qui exécute cette skill) ne lit **jamais** de transcript lui-même. Chaque transcript est lu dans un subagent dédié. Si l'orchestrateur se retrouve à lire 2 transcripts dans la même conversation, c'est un bug d'architecture — relancer en subagents séparés.
- **Les fiches advanced sont consolidées, jamais enrichies incrémentalement.** Un seul appel par élément (Enjeu, Conjoncture, Possible, Methode), par le subagent final, à partir des fiches basics produites. Si un subagent vidéo tente d'écrire ou enrichir une fiche advanced, c'est un bug.
- **Le subagent final ne lit pas les transcripts.** Sa valeur tient précisément à travailler à la granularité « fiche vidéo » — sinon on recrée le problème de compaction initial.
- **Ordre chronologique et séquentiel.** Les subagents vidéo sont lancés un par un, dans l'ordre chronologique, pour que l'évolution temporelle soit lisible et que chaque subagent voie les enrichissements précédents. Jamais en parallèle (conflits sur fiches partagées).
- **Un seul commit, merge direct dans develop.** Même si le batch couvre 10 vidéos, il produit 1 branche, 1 commit, 1 merge `--no-ff` dans `develop`. La branche de travail est supprimée après le merge (locale + distante).
- **Taille du batch.** Minimum 2 vidéos. Moins de 2, utiliser `ingest-video`. Pas de limite supérieure — chaque transcript étant lu par un subagent dédié, la taille du batch n'affecte pas la qualité d'analyse.
- **Fichier de suivi obligatoire.** Cette skill ne travaille pas à partir d'un sujet libre, d'une liste ad-hoc ou d'un bloc temporel. Si l'utilisateur n'en a pas, lui demander d'en créer un (ou utiliser `ingest-video` pour une seule vidéo).
- **Ne jamais référencer le « batch » dans les fiches.** Le découpage en batches est un artefact du workflow d'ingestion — les lecteurs des fiches (Concepts, Enjeux, Individus, Organisations, Vidéos) n'ont pas accès à cette information et ne peuvent pas comprendre des formulations comme « batch D », « ce batch », « le corpus batch », « cf. batch F », « apports du batch X ». Reformuler en nommant le sujet réel (par exemple : « l'arc thématique sur X », « le corpus Y », « les vidéos sur Z », ou simplement supprimer la référence). Cette règle ne s'applique pas aux fichiers de suivi d'ingestion qui sont explicitement des fichiers de travail.

---

## Feedback système

À la fin du batch, évaluer si les subagents ont révélé des éléments qui devraient mettre à jour le système :
- Un thème ou un enjeu qui mérite d'entrer dans la taxonomie du `BUILD.md` de la source ?
- Un concept structurant qui mériterait d'être mentionné dans le `CLAUDE.md` de la source ?
- Une contradiction récurrente entre vidéos qui suggère que la position de la source a évolué ?
- Les exigences de finesse (Étape 5) ont-elles été respectées par tous les subagents vidéo ? Si un subagent a produit une fiche appauvrie malgré la consigne, le signaler.

Signaler à l'utilisateur sans modifier automatiquement.
