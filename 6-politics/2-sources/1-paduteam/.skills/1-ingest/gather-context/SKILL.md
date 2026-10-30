---
name: gather-context
description: >
  Rassemble ce que le vault sait déjà sur un sujet et produit une carte de navigation légère :
  une présentation synthétique + des liens vers les fiches pertinentes. Toujours appelée en amont
  des skills write-* — les write-* ne doivent jamais tenter de faire ce travail elles-mêmes.
  Déclencher quand une skill d'écriture va être lancée, ou quand l'utilisateur demande
  "quel contexte on a sur X", "qu'est-ce qu'on sait de X", "rassemble les infos sur X".
date created: Sunday, April 12th 2026, 6:45:00 pm
date modified: Monday, April 20th 2026, 1:27:51 pm
---

# Skill : Gather Context

## Vue d'ensemble

Cette skill prend un **sujet** (nom d'enjeu, concept, individu, organisation, thème de vidéo, ou question libre) et produit une **carte de navigation** : un document léger contenant une présentation synthétique du sujet et une liste de fiches liées à ouvrir au besoin.

Le document produit est destiné à être consommé par les skills `write-*` (write-enjeu, write-concept, write-entity, write-video). Il peut aussi servir à répondre à une question de l'utilisateur.

## Principe

`.context-tmp.md` est **une carte, pas un dump**. Il ne recopie pas le contenu des fiches. Il présente le sujet en 1-3 paragraphes et liste les fiches pertinentes. Les skills `write-*` en aval sont explicitement chargées d'ouvrir les fiches wikilinkées dont elles ont besoin pour rédiger — gather-context ne fait pas ce travail à leur place.

Ce choix évite de saturer la fenêtre de contexte des `write-*` avec du contenu qu'elles n'utiliseront peut-être pas, et leur laisse l'initiative d'aller chercher la donnée qu'elles exigent vraiment.

---

## Entrée

Un sujet, fourni sous l'une de ces formes :
- Nom d'une fiche existante (ex: "Plus jamais PS", "Jean-Luc Melenchon", "Saint Graphique")
- Thème transversal (ex: "guerre des gauches", "Palestine")
- Titre ou sujet d'une vidéo à ingérer (ex: "les municipales 2026")
- Question libre (ex: "qu'est-ce que la PaduTeam pense du PS ?")

## Sortie

Un fichier temporaire `Sources/.context-tmp.md` (ignoré par git via `.gitignore`) contenant la carte de contexte. Ce fichier est écrasé à chaque appel.

---

## Workflow

### Étape 1 — Identifier les fiches directement liées

Chercher dans le vault les fiches dont le sujet est le thème principal :

1. **Fiche exacte** : si le sujet correspond à un fichier existant dans `Enjeux/`, `Concepts/`, `Individus/`, `Organisations/`, la lire en entier
2. **Fiches vidéo** : chercher dans `Videos/` les fiches qui mentionnent le sujet (grep dans le contenu ou dans les tags thèmes/enjeux du frontmatter)
3. **MOC et Enjeux liés** : ces deux types de fiches sont les meilleurs relais de contexte — elles agrègent des liens thématiques par nature. Chercher dans `MOC/` et `Enjeux/` les fiches qui touchent au sujet (par wikilinks ou par thème). Les lire en priorité.
4. **Fiches entités liées (profondeur 1)** : à partir des wikilinks trouvés dans les fiches ci-dessus (y compris MOC et enjeux), identifier les individus, organisations et concepts les plus pertinents (ceux qui reviennent dans 2+ fiches liées au sujet). Les lire.
5. **Fiches connexes (profondeur 2)** : dans les fiches lues à l'étape 4, relever les wikilinks vers des MOC, enjeux ou concepts qui semblent pertinents pour le sujet. Les lire à leur tour. Privilégier les fiches structurantes (MOC, enjeux, concepts) plutôt que les fiches terminales (individus, organisations) pour la profondeur 2 — elles produisent des connexions plus riches.

**Critère d'arrêt** : ne pas aller au-delà de la profondeur 2. Si une fiche de profondeur 2 ouvre un sujet très différent du sujet initial, ne pas la suivre.

### Étape 1b — Exploration par grep des fiches

La recherche par fiches et wikilinks ne trouve que ce qui est déjà explicitement lié. Pour découvrir des connexions que le vault n'a pas encore formalisées :

1. **Mots-clés du sujet** : générer 5-10 mots-clés et synonymes liés au sujet (ex: pour "Plus jamais PS" → PS, socialiste, Faure, Hollande, trahison, noisette, social-démocratie, gauche molle…)
2. **Grep dans les fiches** uniquement — `Individus/`, `Organisations/`, `Concepts/`, `Enjeux/`, `Videos/`. **Ne pas grep les transcripts** : ils ne sont pas lus à cette étape, et leur rôle (source brute) ne les qualifie pas pour construire la carte de contexte.
3. **Évaluer les pistes** : parmi les résultats grep, identifier les fiches qui n'étaient pas déjà trouvées à l'étape 1. Les lire si elles semblent apporter du contexte nouveau.

Cette étape est particulièrement utile pour :
- Les sujets transversaux qui touchent beaucoup de fiches sans y être centraux
- Les connexions non formalisées (un concept utilisé dans une vidéo mais pas encore lié à l'enjeu)

### Étape 2 — Construire la carte de contexte

Écrire `Sources/.context-tmp.md` avec la structure suivante :

```markdown
# Contexte : {SUJET}

Généré le {DATE} par gather-context.

## Présentation

{1-3 paragraphes synthétisant, à partir des fiches lues :
- les faits essentiels du sujet (ce qu'il est, son cadre temporel, les acteurs en jeu)
- l'analyse PaduTeam (position, combat, grilles de lecture mobilisées)
Ton PaduTeam, pas encyclopédique. Pas de citation longue — la présentation renvoie aux fiches
pour les détails.}

## Fiches liées

### Fiche principale
- [[Nom de la fiche]] — {1 ligne sur son contenu}

### Enjeux
- [[Enjeu A]] — {rapport au sujet, 1 ligne}
- [[Enjeu B]] — {…}

### Concepts
- [[Concept X]] — {rapport, 1 ligne}

### Individus
- [[Personne Y]] — {rapport, 1 ligne}

### Organisations
- [[Org Z]] — {rapport, 1 ligne}

### Vidéos
- [[Vidéo 1]] — {angle sous lequel elle traite le sujet}

## Lacunes

{Optionnel — fiches manquantes qu'on pourrait créer, wikilinks orphelins récurrents,
contradictions entre fiches existantes qui mériteraient une clarification.}
```

Règles de forme :
- Omettre une sous-section si elle est vide (ex: pas de fiche d'organisation pertinente → pas de section « Organisations »).
- La fiche principale (si elle existe) apparaît en premier dans « Fiches liées » avec une description 1 ligne ; son contenu n'est **pas** recopié dans la carte.
- Chaque lien a une courte annotation (1 ligne, ~120 caractères max) expliquant son rapport au sujet — c'est ce qui permet à la skill `write-*` en aval de décider quelles fiches ouvrir en priorité.

### Étape 3 — Rapporter à l'appelant

Résumer en quelques lignes :
- Volume de contexte trouvé (nombre de fiches par catégorie)
- Les lacunes principales
- Recommandation : le contexte est-il suffisant, ou existe-t-il des fiches absentes qui devraient être créées avant de rédiger ?

---

## Règles

- **Ne pas modifier le vault.** Cette skill est en lecture seule — elle ne crée ni ne modifie aucune fiche.
- **Ne pas lire les transcripts.** Les transcripts sont la source brute des fiches vidéo. Leur rôle est en amont (ingestion). Pour le contexte, gather-context se concentre sur les fiches déjà produites.
- **Carte de navigation, pas dump de contenu.** `.context-tmp.md` ne doit pas dépasser ~3K tokens. Si la carte dépasse, resserrer : privilégier les liens + annotations courtes, couper les présentations trop longues. Le détail vit dans les fiches liées — les skills `write-*` iront les ouvrir.
- **Annotations informatives.** L'annotation d'un lien répond à « pourquoi cette fiche pour ce sujet ? ». Pas de tautologie (« Fiche concept X → parle de X »), pas de résumé — une indication de rapport.
