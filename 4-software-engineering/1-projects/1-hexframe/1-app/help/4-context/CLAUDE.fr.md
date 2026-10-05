---
title: Le contexte
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/4-context
owner: diplo
preview: >-
  Le contexte dit ce qu’est une tuile, là où ses enfants disent ce qu’elle fait.
  Jusqu’à six places de contexte, -1 à -6, dans les mêmes directions que les
  enfants ; chacune tient une tuile à elle, ou une référence vers une tuile
  ailleurs dans le système.
---
Les enfants d’une tuile disent ce qu’elle **fait**. Son **contexte** dit ce qu’elle **est** : les principes qu’elle suit, les contraintes sous lesquelles elle vit, ce qu’un lecteur doit savoir avant que les enfants prennent leur sens.

Les enfants d’un code peuvent être son frontend, son backend et sa CI. Son contexte serait les principes selon lesquels il est écrit.

Une tuile a six places de contexte, numérotées de -1 à -6 dans les mêmes directions que ses enfants. Chaque place tient soit :

- une **tuile** à elle, écrite pour cette tuile seule ;
- une **référence** vers une tuile qui vit ailleurs dans le système, quand le même contexte vaut à plusieurs endroits.

Le contexte de cette aide tient une tuile, en `help/-1` : l’idée derrière tout ce qui est ici.
