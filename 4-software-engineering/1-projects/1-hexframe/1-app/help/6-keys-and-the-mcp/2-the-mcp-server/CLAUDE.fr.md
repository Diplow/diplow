---
title: Le serveur MCP
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/6-keys-and-the-mcp/2-the-mcp-server
owner: diplo
preview: >-
  Les outils qu’un agent trouve en /mcp : open_tile et map lisent un système,
  le vôtre ou l’aide, et une écriture par opération change le vôtre. Lisez
  comme l’auteur a disposé : ouvrez une tuile, lisez les aperçus de ses
  enfants, n’ouvrez que ce qui compte.
---
Le serveur MCP en `/mcp` répond à un agent qui envoie une clé en `Authorization: Bearer <clé>`.

Deux outils lisent :

- `open_tile` ouvre une tuile : ce qu’elle dit, son parent, et ses enfants et son contexte par titre et aperçu. Sans identifiant, il ouvre votre racine.
- `map` montre le système sous une tuile, jusqu’à trois générations à la fois, titre et aperçu sauf si on en demande plus.

Les deux lisent aussi l’aide, par ses identifiants : `open_tile({ id: "help" })` ouvre ce guide, `map({ id: "help/3" })` en cartographie une partie.

Les autres écrivent, une par opération : `create_tile`, `edit_tile`, `move_tile`, `swap_tiles`, `delete_tile`, `create_reference` et `delete_reference`. Chaque refus revient comme une erreur d’outil qui le nomme et dit comment le dépasser.

Lisez un système comme son auteur l’a disposé : ouvrez une tuile, lisez les aperçus de ses enfants, et n’ouvrez que ceux qui comptent pour la tâche en cours.
