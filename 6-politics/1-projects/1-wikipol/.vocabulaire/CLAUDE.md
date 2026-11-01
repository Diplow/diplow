---
title: vocabulaire
parent: 6-politics/1-projects/1-wikipol/.vocabulaire
owner: diplo
preview: >-
  Le vocabulaire vivant des mentions d'un Digest : six kinds, les labels et les
  qualifiers de chacun, les relations et les kinds qu'elles relient, chaque
  terme accepté ou proposé ; et les noms connus, canoniques, des personnes et
  des organisations. Je les édite à la main ; check-digest refuse un Digest qui
  sort du vocabulaire.
---
# vocabulaire

Un enfant intérieur de wikipol : les mots avec lesquels un Digest dit qui et quoi sa Publication mentionne, et les noms sous lesquels il les écrit. `vocabulaire.yaml` tient les mots ; `wikipol check-digest` refuse une mention ou une relation qui n'y est pas, et `BUILD.md`, « Les mentions », dit la forme d'une mention dans un Digest. `noms.yaml` tient les noms connus.

| Clé | Ce qu'elle tient |
|---|---|
| `kinds` | Les six sortes de mention : personne, organisation, lieu, événement, œuvre, texte. Chacun a sa `définition`, ses `labels` et ses `qualifiers` |
| `labels` | Ce qu'une mention est dans la Publication, à sa date : une fonction, jamais un jugement (`groupe-armé`, pas `terroriste`). Les jugements de la Source restent dans ses affirmations |
| `qualifiers` | Ce qu'une mention est pour la Publication : `animateur`, `intervenant`, `sujet`… |
| `relations` | Ce qui lie deux mentions d'un même Digest, avec les kinds qu'elles peuvent relier : `from` pour la première, `to` pour la seconde |

Chaque terme porte une `définition` d'une ligne et un `statut` :

- `accepté` : un terme que j'ai gardé.
- `proposé` : un terme que le modèle a ajouté faute d'en trouver un qui convienne, avec `introduit_par`, la clé du Raw de la Publication dont le Digest l'a introduit (`paduteam/URonNSP0qM0.md`, le champ `raw` de ce Digest) : elle ne bouge pas quand la Chronicle range et renumérote. `wikipol digest` et `wikipol backfill` l'écrivent à la fin de son groupe quand le Digest est accepté, sans toucher aux autres lignes. Un Digest peut s'en servir, et je l'accepte, le renomme ou le retire plus tard.
- Un terme retiré garde sa ligne et porte `remplacé_par`, le terme du même groupe qui le remplace. Un Digest qui s'en sert encore est refusé jusqu'à ce qu'il soit réécrit sans lui : ce sera le travail de `wikipol relabel`, que WIK-15 ajoute.

Les termes s'écrivent en minuscules, les mots liés par des tirets : `chef-d-état`, `projet-de-loi`.

## Les noms connus, `noms.yaml`

Par kind (`personne`, `organisation`), une ligne par nom : le nom canonique, bien orthographié, et ses `aliases`, les autres façons dont on l'a écrit ou entendu (un nom de famille seul, un sigle, une faute des sous-titres : `Bezano` pour Besancenot).

```yaml
personne:
  - {name: Adama Traoré, aliases: [Adam Traore]}
organisation:
  - {name: Confédération Paysanne, aliases: [Conf paysanne, La Conf]}
```

`wikipol digest` donne au modèle les noms dont le Raw ou le titre dit une forme, à la casse, aux accents et à la ponctuation près, et le modèle écrit le `name` d'une mention à partir d'eux. La liste a été tirée des fiches `Individus/` et `Organisations/` des vaults figés par `wikipol seed-names`, qui garde les noms déjà là ; une fiche dont le titre était une faute de sous-titres a été corrigée à la main quand un alias était le bon nom (Adama Traoré, Claude Guéant…), les fiches en double d'une même personne fondues en un nom, et les trois partis les plus cités ont pris leur graphie et leur sigle (La France insoumise, Parti socialiste, Rassemblement national) ; `decisions.md` de Labeled Mentions, DEC-8, en donne la liste. `wikipol digest` refuse une mention nommée par l'alias d'un seul nom connu : un ancien nom, juste à sa date (Pôle emploi, Front national), est donc un nom à part, pas un alias. J'y ajoute les noms que les Digests confirment, et je corrige un nom canonique en le mettant dans `name` et l'ancien dans `aliases`.
