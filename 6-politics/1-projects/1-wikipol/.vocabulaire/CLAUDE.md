---
title: vocabulaire
parent: 6-politics/1-projects/1-wikipol/.vocabulaire
owner: diplo
preview: >-
  Le vocabulaire vivant des mentions d'un Digest : six kinds, les labels et les
  qualifiers de chacun, les relations et les kinds qu'elles relient, chaque
  terme accepté ou proposé. Je l'édite à la main ; check-digest refuse un
  Digest qui en sort.
---
# vocabulaire

Un enfant intérieur de wikipol : les mots avec lesquels un Digest dit qui et quoi sa Publication mentionne. `vocabulaire.yaml` les tient ; `wikipol check-digest` refuse une mention ou une relation qui n'y est pas, et `BUILD.md`, « Les mentions », dit la forme d'une mention dans un Digest.

| Clé | Ce qu'elle tient |
|---|---|
| `kinds` | Les six sortes de mention : personne, organisation, lieu, événement, œuvre, texte. Chacun a sa `définition`, ses `labels` et ses `qualifiers` |
| `labels` | Ce qu'une mention est dans la Publication, à sa date : une fonction, jamais un jugement (`groupe-armé`, pas `terroriste`). Les jugements de la Source restent dans ses affirmations |
| `qualifiers` | Ce qu'une mention est pour la Publication : `animateur`, `intervenant`, `sujet`… |
| `relations` | Ce qui lie deux mentions d'un même Digest, avec les kinds qu'elles peuvent relier : `from` pour la première, `to` pour la seconde |

Chaque terme porte une `définition` d'une ligne et un `statut` :

- `accepté` : un terme que j'ai gardé.
- `proposé` : un terme que le modèle a ajouté faute d'en trouver un qui convienne, avec `introduit_par`, le chemin du Digest qui l'a introduit. Un Digest peut s'en servir, et je l'accepte, le renomme ou le retire plus tard.
- Un terme retiré garde sa ligne et porte `remplacé_par`, le terme du même groupe qui le remplace. Un Digest qui s'en sert encore est refusé jusqu'à ce que `wikipol relabel` le réécrive.

Les termes s'écrivent en minuscules, les mots liés par des tirets : `chef-d-état`, `projet-de-loi`.
