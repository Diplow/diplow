---
title: write-period
parent: 6-politics/1-projects/1-wikipol/Skills/write-period
owner: diplo
preview: >-
  Summarizes one Period of a Source's Chronicle, in French, from its children's
  titles and Previews: a Preview of what the Source said over those dates, then
  one to three paragraphs. Run by `wikipol file` through `claude -p` on the model
  pinned in the Source's source.yaml, deepest Periods first; checked after.
name: write-period
description: >
  Résume une Period de la Chronicle d'une Source à partir des titres et des Previews de ses
  enfants (des Digests ou des Periods plus courtes) : un Preview de 350 caractères au plus, puis un
  à trois paragraphes. Lancée par `wikipol file` via `claude -p`, sur le modèle épinglé dans le
  source.yaml de la Source.
---

# Skill : write-period

Tu écris le résumé d'une **Period** : le Tile d'une Chronicle qui couvre une plage de dates et tient soit jusqu'à six Digests, soit jusqu'à six Periods plus courtes (les mots sont ceux du glossaire de wikipol, `CONTEXT.md`). La Chronicle se lit ainsi à toutes les échelles : un lecteur qui ouvre une Period doit savoir ce que la Source a soutenu pendant ces dates, sans ouvrir ses enfants. Le résumé est en français.

## Ce que tu reçois

`wikipol file` te donne tout dans le message, en sections :

1. **La Period** : la Source et son attribution (*la PaduTeam*), la plage de dates, le nombre de Digests qu'elle couvre, et si ses enfants sont des Digests ou des Periods. Quand c'est la Chronicle entière, le message le dit : tu résumes alors tout ce que la Source a publié jusqu'ici.
2. **Le contexte éditorial de la Source**, son `CLAUDE.md` : qui parle, le ton, les pièges de lecture. Il dit comment restituer cette Source. Ses consignes sur un vault, des fiches ou des commandes d'ingestion décrivent l'ancien pipeline et ne te concernent pas.
3. **Ses enfants**, dans l'ordre chronologique : pour chacun, son wikilink, son titre, sa date (un Digest) ou son nombre de Digests (une Period), et son Preview. C'est ta seule matière : tu ne vois ni les Raws, ni le corps des Digests.

Le pipeline écrit lui-même le frontmatter de la Period, son titre (sa plage de dates) et, sous ton résumé, la liste `## Contenu` de ses enfants avec leurs liens : tu ne les écris pas.

## Ce que tu rends

Le document seul, sans phrase avant ni après, sans bloc de code autour :

```markdown
---
preview: >-
  Ce que la Source a soutenu pendant la Period, en une ou deux phrases, 350 caractères au plus.
---
Un premier paragraphe : le fil principal de la Period.

Un deuxième, si la Period en a un autre.
```

## Écrire

### Le Preview

Ce que la Source a soutenu, pas la liste de ses sujets : *La PaduTeam pousse la gauche radicale à rompre avec le PS avant 2027 et lit chaque recul du RN comme une victoire du terrain*, plutôt que *Des vidéos sur le PS et le RN*. Une ou deux phrases, 350 caractères au plus, espaces comprises.

### Le corps

- **Un à trois paragraphes**, sans titre, sans liste, sans citation en bloc : les Extracts restent dans les Digests.
- **Une synthèse, pas un sommaire.** Ne parcours pas les enfants un par un : dis les thèses qui reviennent, ce qui change d'un bout à l'autre de la Period, ce qui la distingue. Un enfant qui ne rejoint aucun fil peut rester hors du résumé : la liste `## Contenu` le montre de toute façon.
- **Restituer, pas neutraliser** : formule les thèses dans les termes de la Source, sans les nuancer ni les challenger. Le `CLAUDE.md` de la Source précise comment. Attribution collective par défaut ; un intervenant nommé seulement si un Preview le nomme.
- **Rien de plus que les Previews.** Un fait, un chiffre, un nom, une date : seulement s'ils sont dans un titre ou un Preview reçu.
- **Des guillemets « »** citent la Source : seulement autour de mots qui sont, tels quels, dans un titre ou un Preview reçu. Pour une formule à toi, pas de guillemets.
- **Des wikilinks** vers les enfants, si tu veux pointer celui qui porte une thèse : recopie le lien reçu, `[[chemin|libellé]]`. Aucun lien vers autre chose.

## Ce que le pipeline vérifie

`wikipol file` refuse le résumé si :

- le Preview est vide ou dépasse 350 caractères ;
- le corps est vide ou dépasse trois paragraphes ;
- une ligne du corps commence par `#` ou par `>` ;
- un wikilink vise autre chose qu'un enfant de la Period ;
- des mots entre « » ne sont dans aucun titre ni aucun Preview reçu.

Un refus te revient une fois, avec la liste des points à corriger : réécris alors le document entier. Un second refus n'écrit rien : la Chronicle reste comme elle était.
