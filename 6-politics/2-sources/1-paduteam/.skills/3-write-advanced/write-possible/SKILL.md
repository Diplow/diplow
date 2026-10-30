---
name: write-possible
description: >
  Rédige ou enrichit une fiche `Possibles/{Nom}.md` (`type: possible`) — un horizon désirable
  défendu par la PaduTeam (choc d'abondance, universalisme matériel, socialisme autogestionnaire,
  désagrégation de l'empire américain comme progrès…). Un possible se distingue d'un enjeu
  (combat) : le combat se mène *contre*, le possible se déploie *vers*. Skill de **rédaction
  pure** : appelée par `synthesize-couche` (orchestrateur générique WikiPol) qui fournit le
  contexte, lit les vidéos source, gère git. Cette skill **ne touche ni à git, ni au contexte**.
date created: 2026-04-25
date modified: 2026-05-01
skill_version: write-possible-2026-05-01
---

# Skill : Write Possible

## Vue d'ensemble

Un **possible** capture une vision du monde positive que la PaduTeam articule comme horizon défendable. Il se reconnaît à trois signes : (1) il énonce un horizon désirable, pas seulement une critique ; (2) il articule un mécanisme matériel (comment on y va) ; (3) il a une *vision adverse* (le possible adverse à combattre). Sans vision adverse, c'est une utopie ; sans mécanisme, c'est un slogan.

## Contrat

Cette skill est appelée par `synthesize-couche` qui lui transmet :
- `target_name` — nom du possible cible
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
- **Sortie** : fiche **`Sources/Paduteam/Possibles/{target_name}.md`** créée ou enrichie. Frontmatter `type: possible`.

## Sections attendues

```markdown
---
type: possible
domaine: [...]
thèmes: [...]
nature: programmatique    # programmatique | contrefactuel
skill_version: write-possible-YYYY-MM-DD
aliases: [...]            # optionnel
acteurs_pivots: [...]     # optionnel
horizon: 2030-12-31       # optionnel
---
#domaine/... #thème/...

# {Nom du possible}

## Horizon
1-3 phrases : quel monde, quelle organisation matérielle, quelle relation aux autres défend ce possible ?

## Mécanisme matériel
Comment on y va concrètement : quelles institutions, quelles luttes, quels rapports de forces produisent cet horizon. Pas une description du résultat — la voie matérielle.

## Vision adverse
Quel possible concurrent est défendu par les adversaires ? (Ex. : pénurie contre abondance, hiérarchie raciale contre universalisme matériel, empire unifié contre désagrégation.) Sans vision adverse explicite, le possible n'a pas de tranchant politique.

## Concepts associés
[[Concept1]], [[Concept2]] — méthodes qui le pensent, conjonctures qui l'ouvrent ou le ferment, enjeux qui le portent.

## Vidéos clés
- [[Titre vidéo]] — comment le possible y est articulé
```

## Enrichissement (fiche existante)

1. **Ne pas supprimer** sauf si factuellement faux
2. **Consolider** plutôt qu'empiler — si un nouvel argument recoupe un existant, renforcer l'existant
3. **Mettre à jour** la Vision adverse si les positions concurrentes ont évolué
4. **Compléter** Vidéos clés et Mécanisme matériel

## Cas d'une fiche legacy `Concepts/<Nom>.md` avec `couche: possible`

Si `target_name` correspond à un Concept existant qui porte un champ `couche: possible`, **ne pas migrer** automatiquement. Créer la nouvelle fiche `Possibles/<target_name>.md` (en récupérant la matière utile du Concept legacy si pertinent) et signaler à l'utilisateur la cohabitation. Le Concept legacy reste tel quel — la migration est hors-périmètre de cette skill.

## Anti-patterns

- **Possible sans vision adverse** : si on ne peut pas nommer ce *contre quoi* le possible se déploie, c'est qu'il n'a pas de contenu politique. La section est obligatoire.
- **Mécanisme idéaliste** : la section *Mécanisme matériel* doit décrire des rapports de forces, pas des bonnes intentions. « On éduquera les gens » n'est pas un mécanisme matériel.
- **Confondre possible et enjeu** : « Plus jamais PS » est un combat (enjeu), « universalisme matériel » est un possible. Si la fiche est centrée sur un *adversaire à abattre* plutôt que sur un horizon, utiliser `write-enjeu`.
- **Référencer le batch ou la skill** : ne jamais écrire « consolidé à partir du batch X » ou « cette synthèse a été produite par write-possible ». L'origine vit dans l'historique git.
