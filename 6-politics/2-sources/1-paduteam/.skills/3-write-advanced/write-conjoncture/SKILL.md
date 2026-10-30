---
name: write-conjoncture
description: >
  Rédige ou enrichit une fiche `Conjonctures/{Nom}.md` (`type: conjoncture`) — un diagnostic
  d'état structurant du moment historique selon la PaduTeam (crise de l'hégémonie américaine,
  triple crise du capitalisme, moïsation, extrême-droitisation, néolibéralisme en crise…).
  Une conjoncture n'est pas un évènement (fait daté) ni une méthode (outil). Skill de **rédaction
  pure** : appelée par `synthesize-couche` (orchestrateur générique WikiPol) qui fournit le
  contexte, lit les vidéos source, gère git. Cette skill **ne touche ni à git, ni au contexte**.
date created: 2026-04-25
date modified: 2026-05-01
skill_version: write-conjoncture-2026-05-01
---

# Skill : Write Conjoncture

## Vue d'ensemble

Une **conjoncture** capture un état structurant du moment historique tel que la PaduTeam le diagnostique. Elle se reconnaît à trois signes : (1) elle décrit un état, pas un fait ponctuel ; (2) elle recouvre plusieurs années ; (3) elle articule un mécanisme causal (pourquoi le monde est dans cet état). C'est ce qui rend lisibles les évènements qui s'y inscrivent.

## Contrat

Cette skill est appelée par `synthesize-couche` qui lui transmet :
- `target_name` — nom de la conjoncture cible
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
- **Sortie** : fiche **`Sources/Paduteam/Conjonctures/{target_name}.md`** créée ou enrichie. Frontmatter `type: conjoncture`.

## Sections attendues

```markdown
---
type: conjoncture
domaine: [...]
thèmes: [...]
statut: ouverte           # ouverte | confirmée | infirmée | dépassée
periode: "2008-2026"
skill_version: write-conjoncture-YYYY-MM-DD
aliases: [...]            # optionnel
horizon: 2030-12-31       # optionnel
---
#domaine/... #thème/...

# {Nom de la conjoncture}

## Diagnostic
1-3 phrases : qu'est-ce que la PaduTeam constate, et pourquoi c'est structurant ?

## Mécanisme
Le rapport causal qui produit cet état (contradictions du capital, basculement géopolitique, recomposition des classes…). Pas une description, une explication.

## Symptômes / manifestations
Comment cette conjoncture se manifeste concrètement — listes des phénomènes visibles qu'elle rend lisibles. Avec wikilinks vers les évènements, individus, organisations.

## Période
Bornes temporelles approximatives. Évènements qui ouvrent / cristallisent / accentuent la conjoncture.

## Concepts associés
[[Concept1]], [[Concept2]] — autres conjonctures qui s'articulent, méthodes mobilisées pour la lire, possibles qu'elle ouvre ou ferme.

## Vidéos clés
- [[Titre vidéo]] — comment la conjoncture y est diagnostiquée
```

## Enrichissement (fiche existante)

1. **Ne pas supprimer** sauf si factuellement faux
2. **Consolider** plutôt qu'empiler — si une nouvelle manifestation recoupe une existante, renforcer l'existante
3. **Mettre à jour** la Période si les bornes ont bougé (cristallisation accentuée, ou symptômes qui suggèrent une fin)
4. **Mettre à jour** le statut (`ouverte` → `confirmée` / `dépassée`) si les vidéos sources le justifient
5. **Compléter** Vidéos clés et Symptômes

## Cas d'une fiche legacy `Concepts/<Nom>.md` avec `couche: conjoncture`

Si `target_name` correspond à un Concept existant qui porte un champ `couche: conjoncture`, **ne pas migrer** automatiquement. Créer la nouvelle fiche `Conjonctures/<target_name>.md` (en récupérant la matière utile du Concept legacy si pertinent) et signaler à l'utilisateur la cohabitation. Le Concept legacy reste tel quel — la migration est hors-périmètre de cette skill.

## Anti-patterns

- **Confondre conjoncture et évènement** : « Élection Trump 2 » est un évènement ; « extrême-droitisation » est une conjoncture qu'il accélère.
- **Diagnostic descriptif sans mécanisme** : la section *Mécanisme* est obligatoire — sans elle, la fiche est juste une description, pas un diagnostic.
- **Bornes temporelles floues** : `periode` doit être renseignée même approximative ; sans repère temporel, on perd l'ancrage matérialiste.
- **Référencer le batch ou la skill** : ne jamais écrire « consolidé à partir du batch X » ou « cette synthèse a été produite par write-conjoncture ». L'origine vit dans l'historique git.
