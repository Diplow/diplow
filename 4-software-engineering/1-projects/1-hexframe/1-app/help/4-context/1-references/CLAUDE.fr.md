---
title: Les références
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/4-context/1-references
owner: diplo
preview: >-
  Une référence place une tuile qui vit ailleurs dans une place de contexte,
  par son identifiant, si bien qu’elle suit la tuile quand celle-ci se déplace.
  Si cette tuile est supprimée, la référence apparaît brisée ; elle n’empêche
  jamais la suppression.
---
Une référence est un lien d’une place de contexte vers une autre tuile du même système. Elle tient l’identifiant de la tuile, pas une copie, donc :

- quand la tuile se déplace, la référence la retrouve ;
- quand la tuile change, la référence montre le changement ;
- quand la tuile est supprimée, la référence reste, affichée **brisée**. Elle n’empêche jamais la suppression.

Une référence montre le titre et l’aperçu de la tuile vers laquelle elle pointe, assez pour qu’un lecteur décide de l’ouvrir.

Une référence n’a pas d’autre place que la sienne. Pour la mettre ailleurs, supprimez-la et créez-en une autre.

Utilisez une référence quand le même contexte vaut pour plusieurs tuiles : écrivez-le une fois, et faites-y référence depuis chacune.
