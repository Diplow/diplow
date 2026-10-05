---
title: Les clés
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/6-keys-and-the-mcp/1-keys
owner: diplo
preview: >-
  Une clé laisse un agent agir pour votre compte au serveur MCP, et nulle part
  ailleurs. Vous en créez une sur la page Clés, voyez son secret une fois, et
  la révoquez là quand l’agent n’en a plus besoin. Une clé ne gère jamais de
  clés.
---
Une clé est un secret qui prouve votre compte au serveur MCP d’hexframe. Créez-en une par agent ou par machine, sur la page **Clés**, et donnez-lui un nom que vous reconnaîtrez.

- Le secret s’affiche **une fois**, quand vous créez la clé, avec la commande qui relie Claude Code à hexframe. Copiez-le à ce moment-là.
- Une clé n’ouvre que le serveur MCP. Elle ne connecte jamais à l’application, et ne peut ni créer, ni lister, ni révoquer de clés : vous seul le pouvez, connecté.
- Révoquez une clé sur la même page dès que son agent n’en a plus besoin. Un agent qui l’utilise est refusé dès son appel suivant.
