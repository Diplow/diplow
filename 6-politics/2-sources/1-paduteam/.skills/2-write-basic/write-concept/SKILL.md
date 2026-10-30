---
name: write-concept
description: >
  Rédige ou enrichit une fiche Concepts/ à partir du contexte vault.
  Les concepts sont le cœur analytique du vault — chaque mécanisme, grille de lecture ou terme technique
  de la PaduTeam mérite sa fiche. Être ambitieux dans la création.
  Appelée par ingest-video pour chaque concept analytique identifié dans un transcript.
date created: Sunday, April 12th 2026, 7:00:00 pm
date modified: Monday, April 20th 2026, 1:27:51 pm
---

# Skill : Write Concept

## Vue d'ensemble

Cette skill rédige ou enrichit les fiches dans `Concepts/`. Les concepts sont la catégorie la plus précieuse du vault — ils constituent le cœur de la grille de lecture PaduTeam : les mécanismes, stratégies, outils analytiques et termes techniques qui structurent toutes leurs analyses.

## Prérequis

- `Sources/.context-tmp.md` existe et a été produit par un appel **récent** à `gather-context` sur le sujet (le concept ou le thème parent). Si ce fichier n'existe pas, ne concerne pas ce sujet, ou paraît périmé, **interrompre** et demander à l'appelant de lancer `gather-context` d'abord. Ne pas tenter de l'exécuter soi-même.
- Ce que le transcript dit du concept a été identifié par l'analyse

**Conventions partagées** : voir `BUILD.md`.

## Navigation de la carte de contexte

`.context-tmp.md` est une **carte** : présentation synthétique + liens annotés vers les fiches pertinentes. Elle ne contient pas les détails. Pour rédiger ou enrichir une fiche Concept, **ouvrir les fiches Vidéos où le concept est développé** pour extraire les formulations et les exemples concrets, et **ouvrir les fiches Individus/Organisations** qui servent d'exemples d'application pour les wikilinker dans la section « Exemples ». Si la fiche Concept existe déjà (carte la liste), l'ouvrir pour ne pas dupliquer ce qui y est déjà.

---

## Entrée

- **Nom du concept**
- **Ce que le transcript dit** du concept (définition, application, exemples)
- **Contexte vault** : `Sources/.context-tmp.md`
- **Fiche existante** (si elle existe)

## Sortie

Une fiche `Concepts/{Nom du concept}.md` créée ou enrichie.

---

## Ce qui fait un concept

Un concept PaduTeam est un **outil analytique** — il sert à comprendre, décrypter, prédire. Il se distingue de :
- Un **enjeu** (position militante, prescriptif) : "Plus jamais PS" n'est pas un concept, c'est un combat
- Un **thème** (sujet descriptif) : "Palestine" n'est pas un concept, c'est un sujet
- Un **fait** (événement) : "les municipales 2026" n'est pas un concept, c'est un événement

Exemples de concepts : Saint Graphique, Moïsation, Mouvement gazeux, Bloc bourgeois, Fascisation par échec de la gauche réformiste, Prophétie du 2002 inverse.

**Seuil de création bas** : si un mécanisme est décrit même brièvement dans une vidéo, il mérite probablement sa fiche. Mieux vaut une ébauche avec une définition de 2 lignes qu'un lien orphelin.

---

## Workflow

### Étape 1 — Création ou enrichissement ?

1. Chercher si la fiche existe (vérifier les alias aussi)
2. Si elle existe → la lire, passer en mode enrichissement
3. Si elle n'existe pas → création

### Étape 2 — Rédiger

#### Template

```markdown
---
type: concept
domaine: [théorie]
thèmes: [thème1]
aliases: [alias1, alias2]
skill_version: write-concept-YYYY-MM-DD
---
#domaine/théorie #thème/thème1

# Nom du concept

## Définition
Ce que le concept signifie dans le cadre analytique de la PaduTeam.
Clair, direct, en 2-5 phrases. Un lecteur qui ne connaît pas la PaduTeam
doit comprendre le concept après avoir lu cette section.

## Mécanisme
Comment ça fonctionne : dynamique cause-conséquence.
C'est le cœur de la fiche — ce qui fait du concept un outil analytique
et pas juste un terme.

## Exemples
Applications concrètes mentionnées dans les vidéos.
Chaque exemple avec un [[wikilink]] vers la vidéo ou l'entité concernée.

## Vidéos où le concept est développé
- [[Titre vidéo 1]]
- [[Titre vidéo 2]]
```

#### Principes de rédaction

- **La définition est autonome** : elle doit fonctionner sans lire le reste de la fiche. Pas de "comme on l'a vu..." ni de renvoi vers d'autres sections.
- **Le mécanisme est la section clé** : un concept sans mécanisme n'est qu'un label. Décrire la dynamique cause → conséquence, les conditions d'application, les limites éventuelles reconnues par la PaduTeam.
- **Les exemples ancrent le concept** : chaque exemple montre le concept en action sur un cas concret (une personne, un événement, une élection). Wikilinker les entités concernées.
- **Domaine** : `théorie` par défaut pour les concepts. Utiliser un autre domaine si le concept est spécifique à un champ (ex: `économie` pour "Baisse tendancielle du taux de profit").

### Étape 3 — Enrichissement (si fiche existante)

1. **Définition** : ne la modifier que si le transcript apporte une formulation plus claire ou plus complète. Ne pas empiler les définitions.
2. **Mécanisme** : ajouter les nuances ou extensions que le transcript apporte. Si le concept est appliqué à un nouveau domaine, l'ajouter.
3. **Exemples** : ajouter les nouvelles applications concrètes. C'est la section qui grossit le plus naturellement — chaque vidéo peut apporter un nouvel exemple.
4. **Vidéos** : ajouter la nouvelle vidéo source.
5. **Nouvelles sections** : si le concept est riche, des sections supplémentaires peuvent émerger (ex: "Le PTB comme anti-modèle de mouvement gazeux" dans la fiche Mouvement gazeux). Les ajouter quand le contenu le justifie.
6. **Mettre à jour** le `statut` si la fiche s'enrichit significativement.

### Étape 4 — Liens vers les enjeux

Un concept sert souvent un ou plusieurs enjeux. Si le lien est clair, l'expliciter :
- Dans la fiche concept : mentionner l'enjeu dans le mécanisme ou les exemples via [[wikilink]]
- Ne pas créer de section "Enjeux associés" dans le concept — c'est l'enjeu qui référence ses concepts, pas l'inverse

Cette asymétrie est intentionnelle : les enjeux agrègent, les concepts sont agrégés.
