---
name: write-conjoncture
description: >
  Rédige ou enrichit une fiche Conjonctures/ pour un diagnostic du moment historique posé par
  la source — un état transitoire nommé (crise hégémonique, basculement, recomposition, triple
  crise…). Distinct d'un Enjeu (combat prescriptif) et d'un Concept (outil pérenne). Appelée par
  ingest-batch en consolidation finale, ou par ingest-video quand un transcript reformule
  significativement une conjoncture.
date created: 2026-04-26
date modified: 2026-04-26
skill_version: write-conjoncture-2026-04-26
---

# Skill : Write Conjoncture

## Vue d'ensemble

Cette skill rédige ou enrichit les fiches dans `Conjonctures/`. Une Conjoncture est un **diagnostic du moment historique** que la source pose explicitement et y revient. Elle a un `statut` (ouverte, confirmée, infirmée, dépassée) qui évolue dans le temps.

Comme `write-enjeu`, cette skill **consolide** la position de la source à partir de plusieurs vidéos — elle n'est pas faite pour empiler des résumés vidéo par vidéo. Préférer l'appel depuis `ingest-batch` (subagent final) plutôt que depuis `ingest-video`, sauf si un transcript révise significativement la conjoncture.

## Prérequis

- `Sources/.context-tmp.md` existe et a été produit par un appel **récent** à `gather-context` sur le sujet de la conjoncture. Si ce fichier n'existe pas, ne concerne pas ce sujet, ou paraît périmé, **interrompre** et demander à l'appelant de lancer `gather-context` d'abord.
- `Conjonctures` est activé dans `source.yaml:content_types`. Sinon, interrompre et signaler à l'appelant.
- Une vue **multi-vidéos** sur la conjoncture est disponible (au moins 2 vidéos qui en parlent, idéalement 3+).

**Conventions partagées** : voir `BUILD.md` de WikiPol (spec frontmatter `conjoncture`).
**Ton et attribution** : voir `CLAUDE.md` de la source.

## Navigation de la carte de contexte

`.context-tmp.md` est une carte. Pour rédiger une fiche Conjoncture, **ouvrir les fiches Vidéos qui posent ou raffinent le diagnostic**, **ouvrir les fiches Concepts** mobilisés (mécanismes par lesquels la conjoncture se déploie), et **ouvrir les fiches Enjeux** que la conjoncture rend saillants. La fiche Conjoncture elle-même si elle existe.

---

## Entrée

- **Nom de la conjoncture** (formule courte que la source utilise — ou que le subagent de consolidation forge si la source n'a pas figé un nom unique)
- **Vue multi-vidéos** : ce que les transcripts disent du diagnostic
- **Contexte vault** : `Sources/.context-tmp.md`
- **Fiche existante** (si elle existe)

## Sortie

Une fiche `Conjonctures/{Nom de la conjoncture}.md` créée ou enrichie.

---

## Ce qui fait une conjoncture

Une Conjoncture est :
- **Un diagnostic** (pas une prescription) : la source décrit un état du monde, pas un combat.
- **Transitoire** : elle a un horizon (parfois explicite, parfois implicite) et un `statut` qui évolue.
- **Récurrente dans l'analyse de la source** : revient dans 2+ vidéos, mobilise plusieurs concepts, oriente la lecture d'événements.

Elle se distingue de :
- Un **Enjeu** (combat prescriptif, position défendue) — la conjoncture est descriptive même quand elle est lourde de conséquences.
- Un **Concept** (outil analytique pérenne) — la conjoncture est datée historiquement ; un Concept est mobilisable dans n'importe quel contexte temporel.
- Un **Evenement** (fait daté ponctuel) — la conjoncture englobe plusieurs faits sous une lecture d'ensemble.

Exemples génériques (chaque source aura les siennes) : « crise d'hégémonie américaine », « moment de recomposition de la gauche », « triple crise écologique-démocratique-sociale ».

---

## Workflow

### Étape 1 — Création ou enrichissement ?

1. Vérifier que `Conjonctures` est activé dans `source.yaml:content_types`. Sinon, interrompre.
2. Chercher si la fiche existe (vérifier les alias).
3. Si elle existe → la lire en entier (statut, horizon, arguments, évolution déjà documentée).
4. Si elle n'existe pas → vérifier le seuil (≥2 vidéos avec diagnostic explicite).

### Étape 2 — Analyser la vue multi-vidéos

Avant de rédiger, identifier :
- **Diagnostic central** : la conjoncture en 1-3 phrases ; ce qu'elle nomme et ce qui la distingue d'autres conjonctures voisines.
- **Mécanismes** : comment elle se déploie (Concepts mobilisés, dynamiques cause-conséquence).
- **Indicateurs** : ce que la source pointe comme signes que la conjoncture est en cours / s'aggrave / se résout.
- **Évolutions** : la position de la source a-t-elle été révisée ? la conjoncture s'est-elle déplacée ?
- **Statut** courant : `ouverte` (en cours), `confirmée` (la source acte qu'elle s'est réalisée), `infirmée` (la source acte qu'elle ne s'est pas réalisée), `dépassée` (un nouveau moment l'a remplacée).

### Étape 3 — Rédiger

#### Template

```markdown
---
type: conjoncture
domaine: [valeur]
thèmes: [thème1, thème2]
statut: ouverte
horizon: YYYY-MM-DD
aliases: [variante1]
skill_version: write-conjoncture-YYYY-MM-DD
---
#domaine/valeur #thème/thème1

# Nom de la conjoncture

## Diagnostic
1-3 phrases : ce que la source pose comme état du monde, et ce qui distingue cette conjoncture
d'autres voisines.

## Mécanismes
Comment la conjoncture se déploie. Articulation avec les [[Concepts]] mobilisés.
Pas de chronologie vidéo-par-vidéo — synthèse par mécanisme.

## Indicateurs
Ce que la source pointe comme signes :
- Indicateur 1 (chiffre ou fait, sourcé en footnote[^1])
- Indicateur 2 …

## Acteurs en jeu
- [[Individu/Organisation A]] — leur position dans la conjoncture
- [[B]] — …

## Concepts associés
[[Concept X]], [[Concept Y]] — outils analytiques mobilisés pour lire la conjoncture.

## Enjeux que la conjoncture rend saillants
- [[Enjeu A]] — comment la conjoncture le rend prioritaire
- [[Enjeu B]] — …

## Évolution
Comment le diagnostic a évolué depuis sa première formulation.
Dates clés, révisions explicites, événements qui l'ont confirmé / infirmé.

## Vidéos clés
- [[Vidéo 1]] — première formulation / formulation la plus claire
- [[Vidéo 2]] — révision / consolidation
- …

[^1]: [MM:SS](https://www.youtube.com/watch?v=ID&t=SECONDS) — "citation"
```

#### Principes de rédaction

- **Diagnostic ≠ combat** : la fiche reste descriptive. Si elle dérive vers « il faut donc… », c'est un Enjeu, pas une Conjoncture. Réorienter via wikilink vers l'Enjeu.
- **Synthèse par mécanisme, pas par vidéo** : la section « Mécanismes » consolide ; ne jamais écrire « dans la vidéo X, la source dit… ». Les vidéos sources sont listées dans « Vidéos clés ».
- **Sourcer les indicateurs** : chiffres et faits saillants en footnote vers la vidéo qui les énonce. Sinon, ne pas les inscrire.
- **`statut` est la signal principal** : un agent qui interroge le vault par grep `statut: ouverte` doit retrouver toutes les conjonctures actives. Maintenir ce champ à jour est plus important que la prose.
- **`horizon` quand explicite** : si la source dit « cette crise va se résoudre d'ici 2030 », inscrire `horizon: 2030-12-31`. Sinon, omettre le champ — ne pas inventer.

### Étape 4 — Enrichissement (si fiche existante)

1. **Diagnostic** : ne reformuler que si la source clarifie ou nuance. Ne pas empiler.
2. **Mécanismes** : ajouter les articulations nouvelles, intégrer les Concepts qui ont émergé entre temps.
3. **Indicateurs** : ajouter les nouveaux indicateurs que les vidéos pointent. Si un indicateur est révisé, garder l'ancien avec la date et noter la révision.
4. **Évolution** : section qui grossit naturellement. Daté chaque révision.
5. **Statut** : mettre à jour si la source acte un changement (passage à `confirmée` / `infirmée` / `dépassée`). Documenter dans « Évolution ».
6. **Horizon** : ajuster si la source révise.

---

## Anti-patterns

- **Conjoncture-zombie** : créer une conjoncture qui n'a été nommée qu'une fois, en passant. Seuil : ≥2 vidéos avec diagnostic explicite.
- **Empilement chronologique** : « dans la vidéo X la source dit A, dans la vidéo Y elle dit B ». La fiche est une synthèse, pas un journal.
- **Confusion avec un Concept** : si l'idée est mobilisable dans n'importe quel contexte (« la fascisation », « la déconstruction sociale »), c'est un Concept. Si elle est datée historiquement (« la crise de 2024-2027 »), c'est une Conjoncture.
- **Dériver vers le combat** : la fiche commence à écrire « il faut donc… ». Si ça arrive, créer/enrichir l'Enjeu correspondant et garder la Conjoncture descriptive.
