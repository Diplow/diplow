---
title: Les opérations
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/5-operations
owner: diplo
preview: >-
  Ce que vous pouvez faire à un système : créer une tuile dans une place libre,
  modifier ce qu’elle dit, la déplacer avec tout ce qui est en dessous, échanger
  deux tuiles, en supprimer une avec tout ce qui est en dessous, et créer ou
  supprimer une référence. Les mêmes opérations dans l’application et par le
  MCP.
---
Chaque changement d’un système est l’un de ceux-ci, dans l’application comme par le MCP :

- **Créer** une tuile dans une place libre sous une autre : un enfant dans une direction, 1 à 6, ou une tuile de contexte, -1 à -6.
- **Modifier** une tuile : son titre, son aperçu ou son contenu.
- **Déplacer** une tuile, avec tout ce qui est en dessous, vers une place libre ailleurs. Une tuile ne peut pas se déplacer sous elle-même.
- **Échanger** deux tuiles : chacune prend la place de l’autre, avec tout ce qui est en dessous. Cela marche même sans place libre. Aucune des deux ne doit se trouver sous l’autre.
- **Supprimer** une tuile et tout ce qui est en dessous. Les références vers elles restent, brisées.
- **Créer** ou **supprimer** une référence dans une place de contexte.

La racine, qui est vous, se modifie mais ne se déplace, ne s’échange ni ne se supprime jamais.

L’aide se lit mais ne change jamais : toute opération qui nomme une tuile de l’aide est refusée.
