---
name: write-evenement
description: >
  Rédige ou enrichit une fiche de couche "évènement" — un fait daté que la PaduTeam analyse
  en profondeur (Guerre USA-Iran 2026, Enlèvement Maduro 2026, Discours Rubio Munich 2026,
  Coup CIA contre Mossadegh 1953…). Un évènement est sélectionné parce qu'il fait nœud
  dans le corpus : il révèle une conjoncture, déplace un rapport de force, ou cristallise
  un combat. Déclencher quand l'utilisateur demande une fiche évènement.
date created: 2026-04-25
date modified: 2026-04-25
---

# Skill : Write Évènement

## Vue d'ensemble

Un **évènement** capture un fait daté que la PaduTeam analyse en profondeur. Il se distingue d'une conjoncture par sa datation précise, et d'un simple sujet de vidéo par son statut de *nœud* dans le corpus : plusieurs vidéos y reviennent, il est mobilisé pour lire d'autres faits, il fait basculer une analyse. Si un fait n'est traité que dans une seule vidéo et n'est pas mobilisé ailleurs, c'est probablement juste un sujet de vidéo, pas un évènement à part entière.

## Prérequis

- `Sources/.context-tmp.md` produit récemment par `gather-context` sur l'évènement
- Conventions partagées : voir `BUILD.md`
- Si une fiche existe déjà, la lire en entier — décider création vs enrichissement

## Entrée / Sortie

- **Entrée** : nom de l'évènement (avec année si possible), contexte gather-context
- **Sortie** : fiche dans `Evenements/{periode}/{Nom de l'évènement}.md`. Sous-dossier de période : `2026/`, `1950-1979/`, etc. — créer si nécessaire. Frontmatter : `type: evenement`, `date: YYYY-MM-DD`, `periode: "..."`.
- **Back-références** : ajouter le nom de l'évènement dans le frontmatter `evenements:` des vidéos qui le traitent significativement.

## Sections attendues

```markdown
---
type: evenement
date: YYYY-MM-DD
date_fin: YYYY-MM-DD       # optionnel, si étendu
periode: "2026"
domaine: [...]
thèmes: [...]
aliases: [...]
skill_version: write-evenement-YYYY-MM-DD
---
#domaine/... #thème/...

# {Nom de l'évènement}

## Faits
Ce qui s'est passé — datation, lieux, acteurs, déroulé. Court (3-5 phrases). Sans interprétation, juste les faits que la PaduTeam tient pour acquis.

## Lecture PaduTeam
L'analyse spécifique de la PaduTeam : qu'est-ce que cet évènement révèle, déplace, ou cristallise selon eux. Section centrale.

## Acteurs
[[Individu1]], [[Organisation1]] — qui agit, contre qui, avec quels intérêts matériels. Ne pas se contenter de lister : restituer ce que chacun cherche.

## Conjonctures révélées
[[Conjoncture1]], [[Conjoncture2]] — quelles conjonctures cet évènement éclaire ou accélère. Articule l'évènement à la couche au-dessus.

## Conséquences
Ce qui change après. Bifurcations ouvertes ou fermées. Si l'évènement est récent, restituer les conséquences anticipées par la PaduTeam.

## Vidéos
- [[Titre vidéo]] — comment l'évènement y est traité
```

## Anti-patterns

- **Liste sans articulation** : Acteurs et Vidéos doivent être commentés (pourquoi cet acteur, pourquoi cette vidéo), pas listés bruts.
- **Confondre évènement et résumé d'actu** : la section *Lecture PaduTeam* est centrale — sans elle, la fiche est du commentaire mainstream, pas une analyse PaduTeam.
- **Oublier la back-référence** : après avoir créé l'évènement, mettre à jour le frontmatter `evenements:` des vidéos qui le traitent. Sans ça, la `.base` ne remontera pas les liens.
