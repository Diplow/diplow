---
title: write-digest
parent: 6-politics/1-projects/1-wikipol/Skills/write-digest
owner: diplo
preview: >-
  Turns one Publication's Raw into its Digest, in French: a Preview that states
  the thesis, then up to six claims, each backed by one to three verbatim
  Extracts linked to the second they start at. Run by `wikipol digest` through
  `claude -p` on the model pinned in the Source's source.yaml; checked after.
name: write-digest
description: >
  Rédige le Digest d'une Publication à partir de son Raw : un Preview (la thèse, 350 caractères au
  plus) et jusqu'à six affirmations, chacune appuyée par une à trois citations exactes du Raw avec
  leur horodatage. Lancée par `wikipol digest` via `claude -p`, sur le modèle épinglé dans le
  source.yaml de la Source.
---

# Skill : write-digest

Tu écris le **Digest** d'une Publication : le Tile qui la résume, ses affirmations appuyées par des **Extracts** de son **Raw** (les mots sont ceux du glossaire de wikipol, `CONTEXT.md`). Le Digest est en français, quelle que soit la langue de ces consignes ou du titre.

Un lecteur pressé lit le Preview et doit savoir ce que la Source soutient. Un lecteur qui doute clique sur un Extract et entend la phrase citée, à la seconde près. Tout ce que tu écris sert ces deux lecteurs.

## Ce que tu reçois

`wikipol digest` te donne tout dans le message, en sections :

1. **La Publication** : la Source et son attribution (*la PaduTeam*), le titre, le `youtube_id`, la date, la durée, et si le Raw est horodaté. Le pipeline remplit lui-même le frontmatter du Digest et son titre à partir de ces champs : tu ne les écris pas.
2. **Le contexte éditorial de la Source**, son `CLAUDE.md` : qui parle, le ton, les pièges de lecture. Lis-le en premier : il dit comment restituer cette Source. Ses consignes sur un vault, des fiches ou des commandes d'ingestion décrivent l'ancien pipeline et ne te concernent pas.
3. **La fiche legacy** de la Publication, quand le vault figé en a une. Elle aide à repérer les intervenants et les thèses, mais elle a pu se tromper : ne recopie ni ses wikilinks, ni ses notes de bas de page, ni ses horodatages. Toute affirmation que tu en tires doit être retrouvée et citée dans le Raw.
4. **Les Digests de la Source que tu peux lier**, s'il y en a.
5. **Le Raw** : la transcription telle qu'elle a été récupérée. Le plus souvent des blocs de 30 s, chacun ouvert par son horodatage (`12:30`, `1:02:30` au-delà d'une heure, ou `**[12:30](...)**` dans quelques vieux Raws). Certains Raws n'ont aucun horodatage.

Lancée à la main sur une Source, la skill lit les mêmes entrées à leur place : le Raw dans le bucket, le `CLAUDE.md` du nœud de la Source sous `6-politics/2-sources/`, la fiche `Videos/` de son vault figé sous `Legacy/`.

## Ce que tu rends

Le document seul, sans phrase avant ni après, sans bloc de code autour :

```markdown
---
preview: >-
  La thèse de la Publication en une ou deux phrases, 350 caractères au plus.
---
## 1. Première affirmation, en une phrase.

Une à trois phrases qui la développent, si elle en a besoin.

> [12:30](https://www.youtube.com/watch?v=YOUTUBE_ID&t=750s) « les mots exacts du Raw »

> [14:00](https://www.youtube.com/watch?v=YOUTUBE_ID&t=840s) « une deuxième citation, si elle ajoute »

## 2. Deuxième affirmation.

> [21:00](https://www.youtube.com/watch?v=YOUTUBE_ID&t=1260s) « ... »
```

Pour un Raw sans horodatage, un Extract n'a pas de lien : `> « les mots exacts du Raw »`.

## Écrire

### Le Preview

La thèse, pas le sujet : *La PaduTeam soutient que le PS prépare 2027 en se recentrant, et que la gauche radicale doit l'en empêcher*, plutôt que *Une vidéo sur le PS*. Une ou deux phrases, 350 caractères au plus, espaces comprises.

### Les affirmations

- **De une à six**, numérotées `## 1.`, `## 2.`… dans l'ordre. Six est un plafond, pas un but : une capsule de cinq minutes en porte souvent deux ou trois.
- **Chacune est une thèse de la Source**, formulée dans ses termes, pas un thème (*Le RN progresse dans les campagnes parce que les services publics s'en retirent*, pas *Le RN et la ruralité*). Restituer, pas neutraliser : ne challenge pas, ne nuance pas ce que la Source ne nuance pas. Le `CLAUDE.md` de la Source précise comment.
- **Attribution collective par défaut** (*la PaduTeam*). Nomme un intervenant seulement quand le Raw l'identifie clairement : il se présente, on l'appelle par son nom, ou le contexte éditorial le désigne.
- **Ordre** : celui de l'argument, le plus central d'abord.
- **Le développement** sous l'affirmation est facultatif : une à trois phrases, quand l'affirmation a besoin de son mécanisme ou de son exemple. Pas de sous-titre, pas de liste.
- **Un chiffre, un sondage, une date** : seulement s'ils sont dans le Raw.
- **Des guillemets « » hors d'un Extract** citent eux aussi la Source : seulement autour de mots qui sont dans le Raw, tels quels. Pour une formule à toi, pas de guillemets, et une citation entre « » tient sur une seule ligne.

### Les Extracts

Chaque affirmation porte **une à trois** citations, chacune sur sa ligne, commençant par `> `, séparées par une ligne vide (sans elle, Markdown les fond en un seul paragraphe).

- **Mot pour mot.** Copie un passage continu du Raw, à l'identique, fautes de transcription comprises : ce sont des sous-titres automatiques, et le validateur cherche ces mots-là, dans cet ordre. Pas de coupe `[…]`, pas de reformulation, pas de mot ajouté. La ponctuation et les majuscules peuvent différer, les mots non.
- **Assez long pour porter l'affirmation** : cinq mots au moins, une à deux phrases en pratique.
- **L'horodatage est celui du bloc où la citation commence.** Recopie l'étiquette du bloc telle quelle et convertis-la en secondes pour `&t=` : `12:30` → `750s`, `1:02:30` → `3750s`. Une citation qui déborde sur le bloc suivant garde l'horodatage du bloc où elle commence. N'invente jamais un horodatage que le Raw n'a pas, ne l'arrondis pas.
- **Le lien** est `https://www.youtube.com/watch?v=<youtube_id>&t=<secondes>s`, avec le `youtube_id` de la Publication.
- **Raw sans horodatage** : `> « citation »`, sans lien.

### Les liens vers d'autres Digests

Les Digests se citent par wikilink, `[[chemin|titre court]]`, dans le développement d'une affirmation : seulement vers un Digest de la liste reçue, et seulement quand la Publication y renvoie vraiment (une suite, une réponse, un même débat). Liste vide : aucun wikilink. Jamais de wikilink vers une fiche du vault figé.

## Ce que le pipeline vérifie

`wikipol digest` assemble le fichier et le refuse si :

- le Preview est vide ou dépasse 350 caractères ;
- il n'y a aucune affirmation, plus de six, ou une numérotation qui saute ;
- une affirmation a zéro ou plus de trois Extracts ;
- un Extract est mal formé, a moins de cinq mots, lie un autre `youtube_id`, un horodatage qui n'ouvre aucun bloc du Raw, une étiquette qui ne vaut pas ses secondes, ou une seconde au-delà de la durée ;
- une citation n'est pas dans le Raw à partir du bloc lié, ou des mots entre « » dans le Preview ou un développement n'y sont pas ;
- un wikilink vise autre chose qu'un Digest de la liste ;
- du texte apparaît avant la première affirmation, ou un titre autre que `## <n>. <affirmation>`.

Un refus te revient une fois, avec la liste des points à corriger : réécris alors le document entier.
