---
name: write-entity
description: >
  Rédige ou enrichit une fiche Individus/ ou Organisations/ à partir du contexte vault.
  Gère les deux types d'entités — les templates sont proches, la logique de création/enrichissement est identique.
  Appelée par ingest-video pour chaque entité significative identifiée dans un transcript.
date created: Sunday, April 12th 2026, 7:00:00 pm
date modified: Monday, April 20th 2026, 1:27:51 pm
---

# Skill : Write Entity (Individus + Organisations)

## Vue d'ensemble

Cette skill rédige ou enrichit les fiches dans `Individus/` et `Organisations/`. Elle gère les deux types car la logique est identique : profil, positionnement Graphique, analyse PaduTeam, relations, vidéos sources.

La valeur principale de cette skill est dans l'**enrichissement** : chaque nouvelle ingestion ajoute une couche d'information sur des entités déjà documentées. La fiche d'un individu mentionné dans 10 vidéos doit être une synthèse cohérente, pas un empilement de 10 passages.

## Prérequis

- `Sources/.context-tmp.md` existe et a été produit par un appel **récent** à `gather-context` sur le sujet (l'entité ou le thème parent). Si ce fichier n'existe pas, ne concerne pas ce sujet, ou paraît périmé, **interrompre** et demander à l'appelant de lancer `gather-context` d'abord. Ne pas tenter de l'exécuter soi-même.
- Ce que le transcript courant dit de l'entité a été identifié par l'analyse (étape 2 de ingest-video)

**Conventions partagées** : voir `BUILD.md`.

## Navigation de la carte de contexte

`.context-tmp.md` est une **carte** : présentation synthétique + liens annotés vers les fiches pertinentes. Elle ne contient pas les détails. Pour rédiger ou enrichir une fiche Individu/Organisation, **ouvrir les fiches Vidéos où l'entité apparaît** pour consolider la trajectoire et les relations, et **ouvrir les fiches Enjeux associées** pour positionner l'entité comme adversaire/allié dans chaque combat. Ouvrir aussi la fiche de l'entité elle-même si elle existe — la carte la liste mais n'en recopie pas le contenu.

---

## Entrée

- **Nom de l'entité** et **type** (individu ou organisation)
- **Ce que le transcript dit** de l'entité (passages pertinents, rôle dans l'analyse)
- **Contexte vault** : `Sources/.context-tmp.md`
- **Fiche existante** (si elle existe — déjà lue)

## Sortie

Une fiche `Individus/{Nom}.md` ou `Organisations/{Nom}.md` créée ou enrichie.

---

## Workflow

### Étape 1 — Création ou enrichissement ?

1. Chercher si la fiche existe (attention aux alias — vérifier aussi les noms alternatifs)
2. Si elle existe → la lire, passer en mode enrichissement
3. Si elle n'existe pas → création

### Étape 2 — Rédiger

#### Template Individu

```markdown
---
type: individu
domaine: [politique-intérieure]
thèmes: [thème1, thème2]
aliases: [alias1, alias2]
skill_version: write-entity-YYYY-MM-DD
---
#domaine/politique-intérieure #thème/thème1 #thème/thème2

# Nom Complet

## Profil synthétique
1-3 phrases : qui est cette personne, quel est son rôle dans les analyses PaduTeam.

## Stratégie et trajectoire
Analyse PaduTeam : stratégie, alliances, erreurs, évolution.

## Relations
- [[Personne ou Org]] — nature de la relation

## Vidéos où X est analysé
- [[Titre vidéo 1]]
- [[Titre vidéo 2]]
```

#### Template Organisation

```markdown
---
type: organisation
domaine: [politique-intérieure]
thèmes: [thème1]
aliases: [alias1]
skill_version: write-entity-YYYY-MM-DD
---
#domaine/politique-intérieure #thème/thème1

# Nom Organisation

## Dynamique
Analyse PaduTeam : stratégie, évolution, forces/faiblesses.

## Figures clés
- [[Personne1]] — rôle
- [[Personne2]] — rôle

## Vidéos où l'organisation est analysée
- [[Titre vidéo]]
```

### Étape 3 — Enrichissement (si fiche existante)

C'est le cas le plus fréquent et le plus important. Règles :

1. **Ne pas supprimer** de contenu existant sauf si factuellement faux
2. **Intégrer, pas empiler** : si le transcript apporte une nouvelle analyse sur la personne, l'intégrer dans la section pertinente plutôt que d'ajouter un paragraphe "Dans la vidéo X..."
3. **Ajouter** la nouvelle vidéo dans "Vidéos où X est analysé"
4. **Mettre à jour** le profil synthétique si de nouvelles infos significatives apparaissent
5. **Contradictions** : si une analyse contredit une précédente, noter les deux — la PaduTeam peut évoluer dans ses analyses. Mentionner le contexte temporel si pertinent.

### Étape 4 — Seuil de création

Ne pas créer de fiche pour chaque nom mentionné en passant. Créer une fiche quand :
- La personne/org est **analysée** (pas juste citée) — la PaduTeam dit quelque chose sur elle
- La personne/org a un **rôle dans l'analyse** (adversaire, allié, exemple, contre-exemple)
- La personne/org est **mentionnée dans 2+ vidéos** (même brièvement — la récurrence justifie une fiche)

Pour les mentions mineures : utiliser le wikilink `[[Nom]]` dans la fiche vidéo sans créer de fiche dédiée. Le lien orphelin sera résolu quand l'entité deviendra plus importante.

**Exception** : si l'entité est mentionnée dans un passage clé (citation marquante, thèse centrale), créer la fiche même en première mention — mieux vaut une ébauche qu'un lien orphelin sur un passage important.
