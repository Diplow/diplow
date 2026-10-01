---
name: write-enjeu
description: >
  Rédige ou enrichit une fiche Enjeux/ à partir du contexte produit par gather-context.
  Contrairement à l'ingestion vidéo par vidéo, cette skill produit des fiches enjeux consolidées
  avec une vue d'ensemble multi-vidéos : arguments récurrents consolidés (pas empilés),
  adversaires identifiés, évolution tracée dans le temps.
  Déclencher quand l'utilisateur demande de créer ou améliorer une fiche enjeu,
  ou quand ingest-video identifie un enjeu qui nécessite un traitement dédié.
date created: Sunday, April 12th 2026, 6:45:00 pm
date modified: 2026-04-20
---

# Skill : Write Enjeu

## Vue d'ensemble

Cette skill rédige ou enrichit une fiche dans `Enjeux/`. Elle se distingue des autres skills d'écriture par son besoin de **vision multi-vidéos** : un enjeu est un combat récurrent qui se construit à travers de nombreuses vidéos. Il ne peut pas être bien documenté à partir d'une seule source.

## Prérequis

- `Sources/.context-tmp.md` existe et a été produit par un appel **récent** à `gather-context` sur l'enjeu concerné. Si ce fichier n'existe pas, ne concerne pas cet enjeu, ou paraît périmé, **interrompre** et demander à l'appelant de lancer `gather-context` d'abord.

**Conventions partagées** (nommage, wikilinks, frontmatter) : voir `BUILD.md` de WikiPol.
**Ton et principes d'attribution** : voir `CLAUDE.md` de la source.
**Taxonomie des enjeux** : voir `BUILD.md` de la source.

## Navigation de la carte de contexte

`.context-tmp.md` est une **carte** : une présentation synthétique + des liens annotés vers les fiches pertinentes. Elle ne contient pas les détails. Pour rédiger une fiche Enjeu — qui consolide des arguments cross-vidéos — **ouvrir systématiquement chaque fiche vidéo liée** listée dans la carte : c'est là que vivent les arguments, les formulations marquantes, les données à consolider. Ouvrir aussi les fiches Concepts liées pour les wikilinks d'outils analytiques, et les fiches Individus/Organisations pour identifier adversaires et alliés.

---

## Entrée

- **Nom de l'enjeu** : le combat stratégique à documenter
- **Contexte** : `Sources/.context-tmp.md` (produit par `gather-context`)
- **Source déclenchante** (optionnel) : le transcript ou la vidéo qui a déclenché la création/enrichissement

## Sortie

Une fiche `Enjeux/{Nom de l'enjeu}.md` créée ou enrichie.

---

## Ce qui distingue un enjeu

Un enjeu n'est ni un concept (outil analytique) ni un thème (sujet descriptif). C'est une **thèse politique militante** que la source défend avec constance :

- **Prescriptif** : "il faut..." / "plus jamais..." / "nous défendons..."
- **Récurrent** : revient dans 3+ vidéos avec une position stable
- **Engagé** : la source prend parti, pas juste elle analyse

Si le sujet est descriptif/analytique plutôt que militant, c'est probablement un concept → utiliser `write-concept` à la place.

---

## Workflow

### Étape 1 — Lire le contexte et la fiche existante

1. Lire `Sources/.context-tmp.md`
2. Si une fiche existe déjà dans `Enjeux/`, la lire en entier
3. Évaluer : création ou enrichissement ?

### Étape 2 — Analyser le contexte multi-vidéos

À partir du contexte rassemblé, identifier :

1. **La position centrale** : quelle est la thèse défendue, en 1-3 phrases ?
2. **Les arguments récurrents** : quels arguments reviennent dans plusieurs vidéos ? Ne pas les empiler vidéo par vidéo — les consolider par thème ou par type d'argument.
3. **Les concepts mobilisés** : quels outils analytiques la source utilise pour défendre cet enjeu ?
4. **Les adversaires** : qui défend la position inverse, et pourquoi selon la source ?
5. **L'évolution** : la position a-t-elle changé ? S'est-elle durcie ? Des événements l'ont-ils confirmée ou infirmée ?
6. **Les vidéos clés** : lesquelles sont les plus importantes pour cet enjeu, et pourquoi ?

### Étape 3 — Rédiger ou enrichir la fiche

#### Création

Utiliser le template :

```markdown
---
type: enjeu
domaine: [valeur]
thèmes: [thème1, thème2]
skill_version: write-enjeu-YYYY-MM-DD
---
#domaine/valeur #thème/thème1 #thème/thème2

# Nom de l'enjeu

## Position de la source
1-3 phrases : la thèse défendue et pourquoi c'est un combat central.

## Arguments récurrents
Arguments consolidés par thème — pas une liste vidéo par vidéo.
Chaque argument doit être compréhensible sans avoir vu la vidéo source.

## Concepts associés
[[Concept1]], [[Concept2]] — les outils analytiques mobilisés pour ce combat.

## Adversaires de cette position
Qui défend la position inverse et pourquoi (selon la source).

## Évolution
Comment cette position a évolué au fil des vidéos.
Événements qui l'ont confirmée ou infirmée.

## Vidéos clés
- [[Titre vidéo 1]] — pourquoi cette vidéo est importante pour cet enjeu
- [[Titre vidéo 2]] — ...
```

#### Enrichissement

Quand la fiche existe déjà :

1. **Ne pas supprimer** de contenu existant sauf si factuellement faux
2. **Consolider** les arguments : si un nouvel argument recoupe un existant, renforcer l'existant plutôt que d'ajouter une ligne
3. **Ajouter** les nouvelles vidéos dans "Vidéos clés" avec une ligne d'explication
4. **Mettre à jour** "Évolution" si de nouveaux événements confirment/infirment la position
5. **Enrichir** "Adversaires" si de nouveaux adversaires apparaissent

### Étape 4 — Vérification

1. Tous les `[[wikilinks]]` pointent vers des fiches existantes ?
2. La fiche est compréhensible sans avoir lu les vidéos sources ?
3. Le ton correspond à celui défini dans le `CLAUDE.md` de la source ?
4. Les arguments sont consolidés, pas empilés vidéo par vidéo ?

---

## Anti-patterns à éviter

- **L'empilement chronologique** : "Dans la vidéo X, la source dit... Dans la vidéo Y, la source dit..." → consolider par argument, pas par source.
- **Le résumé de vidéo** : une fiche enjeu n'est pas une liste de résumés. C'est une synthèse du combat.
- **L'attribution individuelle** : sauf exception (cf. `CLAUDE.md` de la source § Attribution), utiliser la dénomination collective définie pour la source.
- **La neutralisation** : un enjeu est un combat. La fiche doit porter la conviction telle que la source l'exprime, dans la limite des principes éditoriaux définis pour cette source.
