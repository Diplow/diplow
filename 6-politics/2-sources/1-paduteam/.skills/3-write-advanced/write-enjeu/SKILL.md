---
name: write-enjeu
description: >
  Rédige ou enrichit une fiche `Enjeux/{Nom}.md` (`type: enjeu`) au format **loadout militant** :
  la fiche n'est pas un essai analytique, c'est un outil de retrieval pour militer (extraire la
  thèse, désamorcer un cadrage adverse, mobiliser une donnée chiffrée, choisir la bonne vidéo à
  envoyer). Skill de **rédaction pure** : appelée par `synthesize-couche` (orchestrateur générique
  WikiPol) qui fournit le contexte, lit les vidéos source, gère git. Cette skill **ne touche ni à
  git, ni au contexte**. Peut aussi être déclenchée par `ingest-batch` lors de la consolidation
  finale d'un batch d'ingestion.
date created: 2026-04-12
date modified: 2026-05-01
skill_version: write-enjeu-2026-05-01
---

# Skill : Write Enjeu (format loadout)

## Vue d'ensemble

Un enjeu est un combat militant récurrent. La fiche est un **loadout** : optimisée pour la mobilisation, pas pour la lecture linéaire. Le militant arrive avec un besoin précis (quelqu'un m'a sorti X, je dois répondre / je veux convaincre Y) et doit pouvoir extraire en quelques secondes la thèse, les munitions et la vidéo à envoyer.

Différence avec un essai : on n'écrit pas des paragraphes denses, on écrit des bullets scannables. Différence avec un index : chaque section porte une *valeur d'usage* spécifique (désamorcer un cadrage, fournir un fait, orienter un militant).

## Contrat

Cette skill est appelée par `synthesize-couche` (workflow `synthesize`) ou par `ingest-batch` (consolidation finale). Dans les deux cas, elle reçoit :
- `target_name` — nom de l'enjeu cible
- Mode : création ou enrichissement
- Chemin de `Sources/Paduteam/.context-tmp.md` (à lire intégralement)
- Liste des chemins de fiches Vidéos lues par l'orchestrateur (à mobiliser comme matière première)
- Liste des fiches pivots (Concepts/Individus/Organisations) à intégrer en priorité

Cette skill **ne fait que la rédaction**. Elle :
- Ne lance pas `gather-context` (déjà fait par l'orchestrateur)
- Ne touche pas à git (branche, commit, merge gérés par l'orchestrateur)
- Ne lit pas les transcripts (granularité fiche vidéo)
- Ne modifie pas le batch file

## Entrée / Sortie

- **Entrée** : voir « Contrat » ci-dessus.
- **Sortie** : fiche **`Sources/Paduteam/Enjeux/{target_name}.md`** créée ou enrichie. Si l'enjeu est massif (anti-impérialisme, palestine-libre…), le décomposer en sous-fiches `Cas/` n'est pas obligatoire mais peut s'envisager après itération.

## Sections attendues

```markdown
---
type: enjeu
domaine: [...]
thèmes: [...]
skill_version: write-enjeu-YYYY-MM-DD
---
#domaine/... #thème/...

# {Nom de l'enjeu}

## Thèse
La position en 15-25 mots, mobilisable telle quelle.

## Dispositifs adverses à désamorcer
Cadrages que le militant va rencontrer et comment les renvoyer. Une sous-section par dispositif :

### « Citation du cadrage adverse »
Pourquoi c'est un piège, comment le retourner. Wikilink vers la fiche-vidéo qui en montre le démontage si pertinent.

## Arguments de fond
Bullets, pas paragraphes. Chaque bullet = un argument substantiel mobilisable.

## Munitions factuelles
Dates, chiffres, cas précis extractibles sans relire le contexte. Format scannable : *Vote ONU contre Cuba : seuls USA + Israël*. Mettre les chiffres clés en **gras**.

## Adversaires
Qui défend la position inverse, regroupés par type (atlantistes de gauche, ni-nistes, vassaux européens, etc.). Citer les positions précises avec wikilinks.

## Alliés
Pas obligatoire mais utile : qui porte cette position (individus, organisations, structures militantes).

## Concepts-outils
Wikilinks vers les concepts/méthodes/possibles mobilisables. Regrouper par fonction (méthode, analyse, technique impériale, cadre théorique…) si la liste est longue.

## Cas d'application (optionnel)
Si l'enjeu se décline par cas (régions, secteurs), lister chaque cas avec une ligne et un wikilink vers la sous-fiche correspondante. Sinon, omettre cette section.

## Vidéos par usage
Catégoriser par fonction militante, pas par chronologie :

**Pour se former (doctrinal)**
- [[Titre]] — pourquoi cette vidéo

**Pour envoyer à un atlantiste de gauche**
- [[Titre]] — pourquoi

**Pour démonter le dispositif X**
- [[Titre]] — pourquoi

(Adapter les catégories à l'enjeu.)

## Log d'évolution
Chronologique mais dense — marquer les bascules doctrinales et les évènements qui ont confirmé ou recadré la position. Wikilinks vers les évènements pertinents.

- **Date / évènement** — ce qui a changé dans la position ou son intensité
```

## Enrichissement (fiche existante)

1. **Ne pas supprimer** sauf si factuellement faux
2. **Consolider** plutôt qu'empiler — si un nouvel argument recoupe un existant, renforcer l'existant
3. **Mettre à jour** Munitions factuelles avec les nouveaux chiffres clés
4. **Ajouter** dans Vidéos par usage avec la catégorie qui convient
5. **Compléter** le Log d'évolution si l'évènement déplace la position

## Anti-patterns

- **L'essai analytique** : paragraphes longs avec « cependant », « par ailleurs », « en effet ». La fiche est un loadout, pas une dissertation. Privilégier les bullets, les sous-sections courtes, les chiffres en gras.
- **L'empilement chronologique vidéo par vidéo** : « Dans la vidéo X… Dans la vidéo Y… ». Consolider par argument, pas par source.
- **L'attribution individuelle** : sauf exception (cf. `BUILD.md` § Attribution), écrire « la PaduTeam ».
- **La neutralisation** : un enjeu est un combat. La fiche doit porter la conviction, pas la nuancer.
- **Les vidéos en liste plate** : la section *Vidéos par usage* doit catégoriser par fonction militante, pas lister chronologiquement. Si on ne sait pas comment catégoriser, c'est probablement que la fiche n'a pas encore assez de matière.
- **Les Munitions sans gras** : les chiffres clés doivent ressortir au scan. *5% Venezuela / 84% Colombie* en bullet sans gras se perd ; **5%** vs **84%** en gras saute aux yeux.
- **Référencer le batch ou la skill** : ne jamais écrire « consolidé à partir du batch X » ou « cette synthèse a été produite par write-enjeu ». L'origine vit dans l'historique git.
