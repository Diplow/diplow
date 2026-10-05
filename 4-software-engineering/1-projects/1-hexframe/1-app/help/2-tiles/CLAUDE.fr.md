---
title: Les tuiles
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/2-tiles
owner: diplo
preview: >-
  Une tuile est l’unité d’un système : un titre, un aperçu de 350 caractères au
  plus, et un contenu en Markdown. L’aperçu est ce qu’il faut à un lecteur pour
  décider d’ouvrir la tuile, si bien que la plupart des lecteurs n’ont jamais
  besoin du contenu.
---
Une tuile est l’unité d’un système. Elle dit trois choses :

- **Titre** : son nom. Jamais vide.
- **Aperçu** : 350 caractères au plus, comptés comme un lecteur les compte (un emoji compte pour un). C’est ce qu’il faut à un lecteur pour décider d’ouvrir la tuile. Écrivez-le pour que la plupart n’aient pas à le faire.
- **Contenu** : tout le reste, en Markdown. Lu seulement quand quelqu’un ouvre la tuile.

L’aperçu fait le plus gros du travail. Un lecteur parcourt les aperçus des enfants d’une tuile pour choisir où aller, et un agent qui lit par le MCP voit les aperçus bien avant de demander un contenu. Un bon aperçu nomme ce qu’est la tuile et ce qu’on trouverait dedans.

Chaque tuile a un identifiant. Dans votre système, c’est un UUID ; dans l’aide, c’est un chemin depuis la racine de l’aide, comme `help/2` pour cette tuile.
