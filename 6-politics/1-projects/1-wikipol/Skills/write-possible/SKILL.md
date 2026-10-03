---
name: write-possible
description: >
  Rédige ou enrichit une fiche Possibles/ pour une trajectoire alternative que la source imagine
  explicitement — soit contrefactuel (« qu'aurait-il fallu faire »), soit programmatique (« ce que
  serait une société X »). Distinct d'une Conjoncture (diagnostic descriptif) et d'un Enjeu
  (combat tactique). Appelée par ingest-batch en consolidation finale, ou par ingest-video quand
  un transcript articule un Possible neuf.
date created: 2026-04-26
date modified: 2026-04-26
skill_version: write-possible-2026-04-26
---

# Skill : Write Possible

## Vue d'ensemble

Cette skill rédige ou enrichit les fiches dans `Possibles/`. Un Possible est une **trajectoire alternative explicitement imaginée** par la source — pas une analyse de ce qui est, mais une construction de ce qui pourrait ou aurait pu être. Deux natures :

- **`programmatique`** — ce que la source défend comme horizon souhaitable (« une France de l'abondance partagée », « une internationale ouvrière reconstituée »).
- **`contrefactuel`** — ce qui aurait pu se passer si une bifurcation avait été prise (« une PCF maintenu sur la ligne de 1968 », « un programme commun renouvelé en 2002 »).

La distinction est importante : le programmatique se projette en avant, le contrefactuel se projette en arrière. Les deux sont des Possibles.

## Prérequis

- `Sources/.context-tmp.md` existe et a été produit par un appel **récent** à `gather-context` sur le sujet. Si manquant ou périmé, **interrompre** et demander à l'appelant de relancer `gather-context`.
- `Possibles` est activé dans `source.yaml:content_types`. Sinon, interrompre.
- La source a articulé le Possible **explicitement** — pas une déduction d'un combat ou d'une critique. La fiche existe pour ce que la source construit, pas pour ce qu'on en infère.

**Conventions partagées** : voir `BUILD.md` de WikiPol (spec frontmatter `possible`).
**Ton et attribution** : voir `CLAUDE.md` de la source.

## Navigation de la carte de contexte

`.context-tmp.md` est une carte. Pour rédiger une fiche Possible, **ouvrir les fiches Vidéos qui articulent le scénario** (souvent une ou deux vidéos pivot où la source prend le temps de décrire le Possible), **ouvrir les fiches Concepts/Methodes** mobilisés pour le construire, et **ouvrir les fiches Enjeux** que le Possible motive ou résout. La fiche Possible elle-même si elle existe.

---

## Entrée

- **Nom du Possible** (formule courte ; éviter les titres trop génériques)
- **Nature** : `contrefactuel` ou `programmatique`
- **Ce que les transcripts disent** du Possible : acteurs, mécanismes, conditions, horizon
- **Contexte vault** : `Sources/.context-tmp.md`
- **Fiche existante** (si elle existe)

## Sortie

Une fiche `Possibles/{Nom du possible}.md` créée ou enrichie.

---

## Ce qui fait un Possible

Un Possible est :
- **Construit explicitement** par la source : pas une déduction du lecteur. Si la source ne décrit pas le scénario, il n'y a pas de fiche.
- **Articulé** : la source dit qui sont les acteurs pivots, par quels mécanismes le scénario se déploie, à quel horizon.
- **Distinct de la critique du présent** : critiquer ce qui est ne suffit pas — le Possible exige une formulation positive de l'alternative.

Il se distingue de :
- Une **Conjoncture** : descriptif (« le monde est dans tel état ») vs constructif (« et si on faisait autrement »).
- Un **Enjeu** : tactique militante immédiate (« plus jamais PS ») vs vision d'ensemble (« une gauche de classe reconstruite »).
- Un **Concept** : outil analytique pérenne vs scénario projeté.

---

## Workflow

### Étape 1 — Création ou enrichissement ?

1. Vérifier que `Possibles` est activé dans `source.yaml:content_types`. Sinon, interrompre.
2. Chercher si la fiche existe (vérifier les alias).
3. Si elle existe → la lire en entier.
4. Si elle n'existe pas → vérifier le seuil : la source a articulé explicitement le scénario, avec acteurs et mécanismes (pas seulement un slogan).

### Étape 2 — Identifier les composantes

Avant de rédiger, distinguer :
- **Vision** : ce que serait le monde sous le Possible (image d'ensemble en 2-4 phrases).
- **Acteurs pivots** : qui porte ce Possible ou serait sa colonne vertébrale (Individus, Organisations, classes sociales).
- **Mécanismes** : par quelles dynamiques on y arrive ou on y arriverait. Articulation avec [[Concepts]] et [[Methodes]] mobilisés.
- **Conditions** : ce qu'il faudrait pour que le Possible advienne (ou ce qui aurait dû exister, pour les contrefactuels).
- **Obstacles** : ce que la source identifie comme barrières concrètes.

### Étape 3 — Rédiger

#### Template

```markdown
---
type: possible
domaine: [valeur]
thèmes: [thème1, thème2]
nature: programmatique
acteurs_pivots:
  - "[[Individu ou Organisation 1]]"
  - "[[...]]"
horizon: YYYY-MM-DD
aliases: [variante1]
skill_version: write-possible-YYYY-MM-DD
---
#domaine/valeur #thème/thème1

# Nom du Possible

## Vision
2-4 phrases : ce que serait le monde sous ce Possible. Image d'ensemble, pas catalogue.
Doit être lisible sans connaître la conjoncture actuelle.

## Acteurs pivots
- [[Acteur A]] — son rôle dans le scénario
- [[Acteur B]] — …

## Mécanismes
Par quelles dynamiques on y arrive (programmatique) ou on y serait arrivé (contrefactuel).
Synthèse par mécanisme, pas par vidéo. Mobilise [[Concepts]] et [[Methodes]] explicitement.

## Conditions
Ce qu'il faudrait pour que le Possible advienne :
- Condition 1
- Condition 2 (sourcée en footnote si la source l'a énoncée précisément[^1])
…

## Obstacles
Ce que la source identifie comme barrières concrètes. Pas le simple « c'est dur » — les
mécanismes adverses nommés.

## Concepts et méthodes mobilisés
[[Concept X]], [[Methode Y]] — outils par lesquels la source construit le Possible.

## Enjeux que le Possible motive ou résout
- [[Enjeu A]] — comment le Possible articule ce combat
- [[Enjeu B]] — …

## Vidéos où le Possible est articulé
- [[Vidéo 1]] — formulation pivot
- [[Vidéo 2]] — précisions / révisions
- …

[^1]: [MM:SS](https://www.youtube.com/watch?v=ID&t=SECONDS) — "citation"
```

#### Principes de rédaction

- **Vision avant tout** : le lecteur doit pouvoir se représenter le scénario après la première section. Pas de cadrage théorique long avant.
- **Distinguer programmatique et contrefactuel** dès le `nature` du frontmatter et dans la prose : « ce serait » (programmatique) vs « ce aurait été » (contrefactuel). Un agent qui grep `nature: contrefactuel` doit pouvoir filtrer correctement.
- **Acteurs pivots wikilinkés** : la liste des acteurs n'est pas décorative — chacun a un rôle dans le scénario, expliqué en une ligne.
- **Sourcer les conditions** : si la source dit « il faudrait X », footnoter vers la vidéo. Sinon, ne pas inventer la condition.
- **Pas de polémique tactique** : la fiche Possible n'est pas un terrain de combat. Si la prose dérive vers « les autres se trompent parce que… », rapatrier ces formulations dans l'Enjeu pertinent.

### Étape 4 — Enrichissement (si fiche existante)

1. **Vision** : ne modifier que si la source clarifie. Ne pas empiler les visions.
2. **Acteurs pivots / Mécanismes / Conditions / Obstacles** : ajouter les éléments nouveaux. Si une vidéo révise, garder la trace de l'évolution dans une note de fin de section ou en footnote.
3. **Vidéos** : ajouter la nouvelle vidéo source.
4. Mettre à jour `horizon` si la source le précise ou le révise.

---

## Anti-patterns

- **Possible déduit** : créer une fiche Possible parce que « si on suit la logique de l'Enjeu A, alors il faudrait B ». Le Possible doit être articulé par la source, pas par le rédacteur de la fiche.
- **Slogan sans scénario** : « la France insoumise au pouvoir » est un slogan ; « voici à quoi ressemblerait une France insoumise au pouvoir » avec acteurs/mécanismes/conditions est un Possible. Refuser l'un, accepter l'autre.
- **Confusion avec une Conjoncture** : la conjoncture décrit ce qui est ; le Possible décrit ce qui pourrait être. Si la fiche dérive vers du diagnostic, créer/enrichir la Conjoncture associée.
- **Mélange programmatique / contrefactuel** : un seul `nature` par fiche. Si la source articule deux Possibles (un futur souhaité et un passé alternatif), créer deux fiches distinctes.
