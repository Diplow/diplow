---
name: write-methode
description: >
  Rédige ou enrichit une fiche `Methodes/{Nom}.md` (`type: methode`) — une procédure analytique
  réutilisable mobilisée par la PaduTeam (matérialisme historique, Le Graphique, analyse en blocs
  sociaux, analyse concrète de la situation concrète…). Une méthode est un *outil* qui organise
  le regard, pas un sujet ni un combat. Skill de **rédaction pure** : appelée par
  `synthesize-couche` (orchestrateur générique WikiPol) qui fournit le contexte, lit les vidéos
  source, gère git. Cette skill **ne touche ni à git, ni au contexte**.
date created: 2026-04-25
date modified: 2026-05-01
skill_version: write-methode-2026-05-01
---

# Skill : Write Méthode

## Vue d'ensemble

Une **méthode** capture une procédure analytique mobilisée par la PaduTeam pour lire le réel — décomposable en étapes. Elle se reconnaît à quatre signes : (1) elle énonce un principe d'analyse, pas une thèse ; (2) elle est transversale (s'applique à plusieurs objets) ; (3) elle produit des distinctions opérantes ; (4) elle se décompose en étapes ordonnées. Si le sujet décrit *un* phénomène plutôt que *comment regarder*, c'est un concept ordinaire — utiliser `write-concept`.

## Contrat

Cette skill est appelée par `synthesize-couche` qui lui transmet :
- `target_name` — nom de la méthode cible
- Mode : création ou enrichissement
- Chemin de `Sources/Paduteam/.context-tmp.md` (à lire intégralement)
- Liste des chemins de fiches Vidéos lues par l'orchestrateur (à mobiliser comme matière première)
- Liste des fiches pivots (Concepts/Individus/Organisations) à intégrer en priorité

Cette skill **ne fait que la rédaction**. Elle :
- Ne lance pas `gather-context` (déjà fait par l'orchestrateur)
- Ne touche pas à git (branche, commit, merge gérés par l'orchestrateur)
- Ne lit pas les transcripts (granularité fiche vidéo)
- Ne modifie pas le batch file
- Ne crée pas de fiches Concepts existantes pour y poser un champ `couche:` — cette pratique est legacy

## Entrée / Sortie

- **Entrée** : voir « Contrat » ci-dessus.
- **Sortie** : fiche **`Sources/Paduteam/Methodes/{target_name}.md`** créée ou enrichie. Frontmatter `type: methode`.

## Sections attendues

```markdown
---
type: methode
domaine: [...]
thèmes: [...]
etapes:
  - "Étape 1 courte"
  - "Étape 2 courte"
skill_version: write-methode-YYYY-MM-DD
aliases: [...]            # optionnel
---
#domaine/... #thème/...

# {Nom de la méthode}

## Définition
1-3 phrases : qu'est-ce que cette méthode énonce comme principe d'analyse ?

## Mécanisme
Comment elle opère, étape par étape : quelles distinctions elle produit, quels rapports elle met en lumière, ce qu'elle rend visible que d'autres méthodes ratent. Restituer les *étapes* du frontmatter avec leur substance.

## Exemples d'application
2-4 cas concrets où la PaduTeam mobilise cette méthode (avec wikilinks vers les vidéos, les individus analysés, les enjeux éclairés).

## Concepts dérivés
[[Concept1]], [[Concept2]] — outils analytiques qui découlent de cette méthode ou la spécifient.

## Adversaires méthodologiques
Méthodes alternatives critiquées par la PaduTeam (idéalisme, culturalisme, individualisme méthodologique, etc.). Pourquoi cette méthode est jugée supérieure.

## Vidéos où elle est mobilisée
- [[Titre vidéo]] — comment elle y est appliquée
```

## Enrichissement (fiche existante)

1. **Ne pas supprimer** sauf si factuellement faux
2. **Consolider** plutôt qu'empiler — si un nouvel exemple recoupe un existant, renforcer l'existant
3. **Mettre à jour** les `etapes` du frontmatter si la formulation s'est précisée
4. **Compléter** Adversaires méthodologiques si le corpus apporte de nouvelles critiques

## Cas d'une fiche legacy `Concepts/<Nom>.md` avec `couche: methode`

Si `target_name` correspond à un Concept existant qui porte un champ `couche: methode`, **ne pas migrer** automatiquement. Créer la nouvelle fiche `Methodes/<target_name>.md` (en récupérant la matière utile du Concept legacy si pertinent) et signaler à l'utilisateur la cohabitation. Le Concept legacy reste tel quel — la migration est hors-périmètre de cette skill.

## Anti-patterns

- **Confondre méthode et concept** : si la fiche décrit *un état du monde* (ex. moïsation), c'est une conjoncture, pas une méthode. Si elle décrit *un horizon désirable*, c'est un possible.
- **Énumérer sans articuler** : la section *Mécanisme* doit dire *comment* la méthode produit ses distinctions, pas juste *quoi* elle observe.
- **Oublier la transversalité** : une méthode s'applique à plusieurs objets. Donner au moins 2 exemples d'objets différents éclairés par elle.
- **Étapes vides ou trop générales** : `etapes` du frontmatter doit lister des actions concrètes, pas des slogans (« Identifier la PCS dominante » plutôt que « Analyser les classes »).
- **Référencer le batch ou la skill** : ne jamais écrire « consolidé à partir du batch X » ou « cette synthèse a été produite par write-methode ». L'origine vit dans l'historique git.
