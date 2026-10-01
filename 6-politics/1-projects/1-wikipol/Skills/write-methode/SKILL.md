---
name: write-methode
description: >
  Rédige ou enrichit une fiche Methodes/ pour une procédure analytique réutilisable que la source
  enseigne ou applique systématiquement (lecture de bloc social, matérialisme historique, analyse
  par rapports de classe…). Distincte d'un Concept (what-is) — c'est un how-to. Distincte d'un
  Enjeu (combat) — c'est un outil. Appelée par ingest-batch en consolidation, ou par ingest-video
  quand un transcript explicite ou raffine une méthode.
date created: 2026-04-26
date modified: 2026-04-26
skill_version: write-methode-2026-04-26
---

# Skill : Write Methode

## Vue d'ensemble

Cette skill rédige ou enrichit les fiches dans `Methodes/`. Une Methode est une **procédure réutilisable** que la source applique ou enseigne — un mode d'emploi analytique, pas un concept. La distinction est :

- **Concept** : un quoi-ce-est (« le bloc bourgeois », « l'hégémonie »).
- **Methode** : un comment-faire (« comment lire un bloc social », « comment décomposer une crise hégémonique »).

Une fiche Methode a vocation à être consultable par un militant ou un analyste qui voudrait **appliquer** la méthode à un nouveau cas, pas seulement la comprendre.

## Prérequis

- `Sources/.context-tmp.md` existe et a été produit par un appel **récent** à `gather-context` sur le sujet. Si manquant ou périmé, **interrompre** et demander à l'appelant de relancer `gather-context`.
- `Methodes` est activé dans `source.yaml:content_types`. Sinon, interrompre.
- La source enseigne ou applique la méthode dans **2+ vidéos** (ou 1 vidéo si la méthode y est décrite avec un déroulé d'étapes explicite).

**Conventions partagées** : voir `BUILD.md` de WikiPol (spec frontmatter `methode`).
**Ton et attribution** : voir `CLAUDE.md` de la source.

## Navigation de la carte de contexte

`.context-tmp.md` est une carte. Pour rédiger une fiche Methode, **ouvrir les fiches Vidéos où la méthode est appliquée** pour extraire les étapes concrètes et les exemples, et **ouvrir les fiches Concepts** que la méthode mobilise (les outils que la procédure utilise). La fiche Methode elle-même si elle existe.

---

## Entrée

- **Nom de la méthode** (formule courte, descriptive)
- **Ce que les transcripts disent** : étapes, conditions d'application, exemples, limites
- **Contexte vault** : `Sources/.context-tmp.md`
- **Fiche existante** (si elle existe)

## Sortie

Une fiche `Methodes/{Nom de la methode}.md` créée ou enrichie.

---

## Ce qui fait une Methode

Une Methode est :
- **Procédurale** : on peut la décomposer en étapes ordonnées, chacune avec une consigne explicite.
- **Réutilisable** : applicable à plusieurs cas, pas à un cas singulier.
- **Enseignée par la source** : la source dit « voici comment on fait » ou applique systématiquement la procédure à des cas variés (de manière qu'on puisse en induire les étapes).

Elle se distingue de :
- Un **Concept** : un Concept *définit* ; une Methode *fait*. « Le Graphique » est un Concept (c'est une matrice). « Lire le Graphique » est une Methode (c'est une procédure).
- Une **Methode** ne porte pas un combat. Si la procédure est mobilisée pour un combat, le combat est un Enjeu et la Methode reste un outil.
- Un **Possible** : la Methode existe dans le présent comme outil ; le Possible se projette dans une trajectoire alternative.

**Seuil de création moyen** : plus exigeant que pour un Concept. Une Methode existe si on peut effectivement écrire des étapes, pas juste un nom + une définition.

---

## Workflow

### Étape 1 — Création ou enrichissement ?

1. Vérifier que `Methodes` est activé dans `source.yaml:content_types`. Sinon, interrompre.
2. Chercher si la fiche existe (vérifier les alias).
3. Si elle existe → la lire en entier (étapes déjà documentées, limites, exemples).
4. Si elle n'existe pas → vérifier le seuil : peut-on écrire une procédure en étapes ? Si non, c'est probablement un Concept.

### Étape 2 — Reconstituer la procédure

Avant de rédiger, identifier :
- **Définition** : que fait la méthode ? quel résultat produit-elle ?
- **Conditions d'application** : sur quel type de matériau / cas la méthode opère-t-elle ?
- **Étapes** : la procédure décomposée. Chaque étape a une consigne et idéalement une question-pivot.
- **Outils mobilisés** : Concepts utilisés à chaque étape.
- **Exemples** : applications concrètes vues dans les vidéos. Wikilinks vers les Vidéos / Evenements.
- **Limites** : cas où la méthode ne s'applique pas, ou produit un résultat ambigu, reconnus par la source.

### Étape 3 — Rédiger

#### Template

```markdown
---
type: methode
domaine: [théorie]
thèmes: [thème1]
etapes:
  - "Étape 1 (résumé court pour grep)"
  - "Étape 2"
  - "Étape 3"
aliases: [variante1]
skill_version: write-methode-YYYY-MM-DD
---
#domaine/théorie #thème/thème1

# Nom de la méthode

## Définition
2-5 phrases : ce que la méthode fait, le résultat qu'elle produit. Pas de jargon non défini —
si un terme est lui-même un Concept, le wikilinker.

## Conditions d'application
Sur quel type de cas / matériau la méthode opère :
- Cas où elle s'applique pleinement
- Cas où elle s'applique partiellement (avec ajustement)
- Cas où elle ne s'applique pas

## Étapes

### 1. Titre de l'étape
Consigne. Question-pivot que l'analyste se pose à cette étape.
Concepts mobilisés : [[Concept X]].

### 2. Titre de l'étape
…

### 3. Titre de l'étape
…

## Outils mobilisés
[[Concept X]], [[Concept Y]] — quels Concepts la méthode mobilise et à quelle étape.

## Exemples
- [[Vidéo 1]] — application au cas A : la source montre que l'étape 2 isole [[Acteur Z]] comme variable.
- [[Vidéo 2]] — application au cas B : illustre une limite de la méthode (cf. section Limites).
- [[Evenement E]] — application au fait E.

## Limites
Reconnues par la source. Cas où la méthode produit un résultat ambigu ou faux.
Important : ne pas inventer de limites — n'inscrire que celles que la source mentionne explicitement.

## Vidéos où la méthode est mobilisée
- [[Vidéo 1]]
- [[Vidéo 2]]
- …
```

#### Principes de rédaction

- **`etapes:` en frontmatter** : la liste courte (un titre par étape) sert au grep et à la table des matières d'un MOC. Le détail de chaque étape vit dans le corps.
- **Chaque étape a une consigne ET une question-pivot** : la consigne dit quoi faire ; la question-pivot dit ce que l'analyste se demande à ce moment. Sans la question-pivot, la méthode est cargo-cult.
- **Wikilinker densément les Concepts mobilisés** : la Methode est une orchestration de Concepts. Si un Concept manque, créer la fiche.
- **Distinguer Methode et Concept** dans la section Définition : ne pas commencer par « X est un cadre de pensée qui… » (c'est un Concept) — commencer par « X est une procédure qui produit Y à partir de Z ».
- **Limites sourcées uniquement** : la tentation de compléter les limites « par bon sens » est forte ; ne pas y céder. Si la source ne reconnaît pas de limite, écrire « Pas de limite explicitement reconnue par la source ».

### Étape 4 — Enrichissement (si fiche existante)

1. **Définition** : ne reformuler que si la source clarifie. Ne pas empiler.
2. **Étapes** : la section qui peut évoluer le plus. Si la source affine ou renomme une étape, mettre à jour `etapes:` en frontmatter et le corps. Garder une trace de l'ancienne formulation en footnote si la révision est significative.
3. **Conditions d'application / Limites** : ajouter les nuances qu'une nouvelle vidéo apporte.
4. **Exemples** : section qui grossit naturellement. Chaque vidéo qui applique la méthode peut fournir un exemple.
5. **Vidéos** : ajouter la nouvelle vidéo source.

---

## Anti-patterns

- **Methode-pancarte** : créer une fiche pour un nom qui sonne procédural mais sans étapes effectives. Si on ne peut pas écrire ≥2 étapes ordonnées, c'est un Concept.
- **Empilement par vidéo** : « la source applique la méthode dans la vidéo X pour étudier Y ». La fiche est une procédure, pas un journal d'applications. Les exemples sont en section dédiée, courts.
- **Inventer les limites** : la fiche perd sa fidélité dès qu'on ajoute des limites que la source n'a pas reconnues. Mieux vaut « Pas de limite explicite » qu'une limite inventée.
- **Confusion avec un Possible** : la Methode opère sur le présent comme outil ; un Possible est une trajectoire imaginée. Si la « méthode » est en fait « ce qu'on ferait si… », c'est un Possible.
