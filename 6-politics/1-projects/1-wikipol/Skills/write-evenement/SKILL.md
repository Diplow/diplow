---
name: write-evenement
description: >
  Rédige ou enrichit une fiche Evenements/ pour une occurrence singulière datée que la source
  analyse en profondeur (élection, manifestation, vote, sommet, attentat, mobilisation). Distinct
  d'un Concept (mécanisme abstrait) et d'un Enjeu (combat stratégique). Appelée par ingest-video
  pour chaque événement daté analysé non-trivialement dans un transcript.
date created: 2026-04-26
date modified: 2026-04-26
skill_version: write-evenement-2026-04-26
---

# Skill : Write Evenement

## Vue d'ensemble

Cette skill rédige ou enrichit les fiches dans `Evenements/`. Une fiche Evenement existe quand la source **analyse** un fait daté singulier — pas quand elle se contente de le mentionner. Le seuil est plus haut que pour un Concept : un événement n'a pas vocation à être systématiquement créé en passe unique.

## Prérequis

- `Sources/.context-tmp.md` existe et a été produit par un appel **récent** à `gather-context` sur le sujet (l'événement ou son contexte). Si ce fichier n'existe pas, ne concerne pas ce sujet, ou paraît périmé, **interrompre** et demander à l'appelant de lancer `gather-context` d'abord. Ne pas tenter de l'exécuter soi-même.
- `Evenements` est activé dans `source.yaml:content_types`. Sinon, interrompre et signaler à l'appelant.
- Ce que le transcript dit de l'événement a été identifié par l'analyse (étape 2 de ingest-video).

**Conventions partagées** : voir `BUILD.md` de WikiPol (spec frontmatter `evenement`).
**Ton et attribution** : voir `CLAUDE.md` de la source.

## Navigation de la carte de contexte

`.context-tmp.md` est une **carte** : présentation synthétique + liens annotés. Pour rédiger une fiche Evenement, **ouvrir les fiches Vidéos où l'événement est analysé** pour extraire les chiffres, déroulés et formulations marquantes, et **ouvrir les fiches Individus/Organisations des acteurs principaux** pour les wikilinker précisément. Si la fiche Evenement existe déjà, l'ouvrir.

---

## Entrée

- **Nom de l'événement** (titre court, descriptif, sans accents)
- **Date(s)** — au minimum `date_debut` ; `date_fin` si l'événement s'étale dans le temps
- **Ce que le transcript dit** de l'événement (déroulé, acteurs, conséquences vues par la source)
- **Contexte vault** : `Sources/.context-tmp.md`
- **Fiche existante** (si elle existe)

## Sortie

Une fiche `Evenements/{Nom de l'evenement}.md` créée ou enrichie. Si la source organise les événements par période, la fiche peut être placée sous `Evenements/<période>/` (ex: `Evenements/2026/`, `Evenements/1950-1979/`) — voir `BUILD.md` de la source.

---

## Ce qui fait un événement

Une fiche Evenement existe pour un fait :
- **Daté** (au minimum une date de début connue)
- **Singulier** (pas un processus récurrent — un processus est un Concept ou une Methode)
- **Analysé en profondeur** par la source (chiffres, déroulé, conséquences politiques, lecture analytique)

Ne pas créer de fiche pour :
- Une simple mention en passant (« comme on l'a vu en mai 2024... »)
- Un événement-type récurrent (les présidentielles en général → c'est un Concept ou un Thème ; mais une présidentielle particulière qui est analysée → fiche Evenement)
- Un fait ponctuel sans analyse propre (juste un repère temporel)

**Seuil de création moyen** : à la différence des Concepts (seuil bas), créer une fiche Evenement seulement quand la source y consacre du temps (≥1-2 minutes d'analyse) ou y revient dans plusieurs vidéos. Mieux vaut un wikilink wikifié dans une fiche Vidéo qu'une fiche stub vide.

---

## Workflow

### Étape 1 — Création ou enrichissement ?

1. Vérifier que `Evenements` est activé dans `source.yaml:content_types`. Sinon, interrompre.
2. Chercher si la fiche existe (vérifier les alias aussi, et les sous-dossiers par période)
3. Si elle existe → la lire, passer en mode enrichissement
4. Si elle n'existe pas → création

### Étape 2 — Rédiger

#### Template

```markdown
---
type: evenement
domaine: [valeur]
thèmes: [thème1, thème2]
date_debut: YYYY-MM-DD
date_fin: YYYY-MM-DD
lieu: "Ville ou pays"
acteurs:
  - "[[Individu ou Organisation principal·e 1]]"
  - "[[...]]"
aliases: [variante1]
skill_version: write-evenement-YYYY-MM-DD
---
#domaine/valeur #thème/thème1

# Nom de l'événement

## Présentation
1-3 phrases : ce qu'est l'événement, son cadre temporel, qui est en jeu.
Réponse à : « pourquoi cet événement mérite une fiche dans le vault de la source ? »

## Déroulé
Les faits structurants, dans l'ordre. Chiffres, dates intermédiaires, prises de parole clés.
Footnoter les passages sourcés depuis une vidéo[^1].

## Acteurs
- [[Individu A]] — son rôle
- [[Organisation B]] — son rôle

## Lecture de la source
Comment la source analyse cet événement : qu'est-ce qu'il révèle ? quelle grille de lecture est mobilisée ?
Wikilinks vers les Concepts/Methodes appliqués.

## Conséquences
Ce que la source identifie comme conséquences politiques, sociales, stratégiques.
Wikilinks vers les Enjeux ou Conjonctures impactés.

## Vidéos où l'événement est analysé
- [[Titre vidéo 1]]
- [[Titre vidéo 2]]

[^1]: [MM:SS](https://www.youtube.com/watch?v=YOUTUBE_ID&t=SECONDS) — "citation ou résumé"
```

#### Principes de rédaction

- **Présentation autonome** : un lecteur qui n'a pas suivi l'actualité doit comprendre l'événement après cette section. Pas de présupposition de connaissance contextuelle.
- **Déroulé sourcé** : les chiffres et faits saillants sont footnotés vers les vidéos. Le helper `Scripts/timestamp_to_seconds.py` convertit les MM:SS en secondes pour les liens `&t=`.
- **Lecture analytique distincte du déroulé** : la section « Lecture de la source » ne répète pas les faits ; elle dit ce que la source en tire (« la source y voit la confirmation de [[Concept X]] », pas « selon la source, l'événement a eu lieu le… »).
- **Wikilinker densément les acteurs** : chaque Individu/Organisation cité dans le déroulé est wikilinké au moins une fois. Si la fiche cible n'existe pas, créer une ébauche via `write-entity` plutôt que laisser un lien orphelin.
- **Domaine et thèmes** : utiliser les valeurs déclarées dans le `BUILD.md` de la source. Un événement peut couvrir 1-2 domaines (ex: une élection → `politique-intérieure` ; un sommet UE → `géopolitique` + `économie`).

### Étape 3 — Enrichissement (si fiche existante)

1. **Présentation** : ne modifier que si nouveau cadrage substantif. Pas d'empilement.
2. **Déroulé** : ajouter les nouveaux faits ou nuances apportés par le transcript courant. Si une vidéo ultérieure révise un chiffre, mettre à jour et garder les deux dates en footnote.
3. **Lecture de la source** : ajouter les nouvelles grilles de lecture, mais identifier les évolutions (« position initialement X, ensuite déplacée vers Y dans la vidéo Z »).
4. **Conséquences** : ajouter ce qui est devenu visible avec le recul.
5. **Vidéos** : ajouter la nouvelle vidéo source.
6. Mettre à jour `skill_version` et la `date_fin` si l'événement s'est terminé entre temps.

### Étape 4 — Liens vers les Enjeux et Conjonctures

Un événement peut alimenter un ou plusieurs Enjeux et/ou éclairer une Conjoncture. Si les liens sont clairs, les expliciter dans la section « Conséquences » via [[wikilink]]. Ne pas créer de section dédiée — c'est l'Enjeu/la Conjoncture qui référence l'événement, pas l'inverse (asymétrie d'aggrégation).

---

## Anti-patterns

- **Confondre événement et conjoncture** : « la crise de 2024 » est une conjoncture (état transitoire) ; « l'élection présidentielle de 2027 » est un événement (fait daté). En cas de doute, demander si la source en parle au passé/futur précis (événement) ou comme d'un état d'ensemble (conjoncture).
- **Stub orphelin** : créer une fiche avec seulement nom + date sans analyse — préférer un wikilink dans la fiche Vidéo qui mentionne l'événement, et créer la fiche le jour où la source y consacre une analyse.
- **Mélange déroulé / lecture** : raconter les faits depuis la perspective de la source dans le déroulé. Le déroulé est factuel ; la perspective vit dans « Lecture de la source ».
- **Créer un événement pour structurer un suivi** : si on a besoin d'agréger plusieurs faits sous un même thème, c'est probablement un Enjeu ou une Conjoncture, pas un Evenement.
