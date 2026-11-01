---
title: write-digest
parent: 6-politics/1-projects/1-wikipol/Skills/write-digest
owner: diplo
preview: >-
  Turns one Publication's Raw into its Digest, in French: a Preview that states
  the thesis, its mentions with canonical names, then up to six claims, each
  backed by one to three verbatim Extracts linked to the second they start at.
  Run by `wikipol digest` through `claude -p` on the model pinned in the
  Source's source.yaml; checked after.
name: write-digest
description: >
  Rédige le Digest d'une Publication à partir de son Raw : un Preview (la thèse, 350 caractères au
  plus), ses mentions (qui et quoi elle nomme, au nom canonique) et jusqu'à six affirmations, chacune appuyée par une à trois citations exactes du Raw avec
  leur horodatage. Lancée par `wikipol digest` via `claude -p`, sur le modèle épinglé dans le
  source.yaml de la Source.
---

# Skill : write-digest

Tu écris le **Digest** d'une Publication : le Tile qui la résume, ses affirmations appuyées par des **Extracts** de son **Raw** (les mots sont ceux du glossaire de wikipol, `CONTEXT.md`). Le Digest est en français, quelle que soit la langue de ces consignes ou du titre.

Un lecteur pressé lit le Preview et doit savoir ce que la Source soutient. Un lecteur qui doute clique sur un Extract et entend la phrase citée, à la seconde près. Un lecteur qui cherche une personne, un parti ou un livre à travers les Digests la trouve par ses mentions, sous son vrai nom. Tout ce que tu écris sert ces trois lecteurs.

## Ce que tu reçois

`wikipol digest` te donne tout dans le message, en sections :

1. **La Publication** : la Source et son attribution (*la PaduTeam*), le titre, le `youtube_id`, la date, la durée, et si le Raw est horodaté. Le pipeline remplit lui-même le frontmatter du Digest et son titre à partir de ces champs : tu ne les écris pas.
2. **Le contexte éditorial de la Source**, son `CLAUDE.md` : qui parle, le ton, les pièges de lecture. Lis-le en premier : il dit comment restituer cette Source. Ses consignes sur un vault, des fiches ou des commandes d'ingestion décrivent l'ancien pipeline et ne te concernent pas.
3. **La fiche legacy** de la Publication, quand le vault figé en a une. Elle aide à repérer les intervenants et les thèses, mais elle a pu se tromper : ne recopie ni ses wikilinks, ni ses notes de bas de page, ni ses horodatages. Toute affirmation que tu en tires doit être retrouvée et citée dans le Raw.
4. **Les Digests de la Source que tu peux lier**, s'il y en a.
5. **Les animateurs de la Source**, quand son `source.yaml` en déclare : ils mènent chaque Publication, même quand le Raw ne dit pas leur nom.
6. **Le vocabulaire des mentions**, `vocabulaire.yaml` : les kinds, et pour chacun ses labels et ses qualifiers, puis les relations, chaque terme avec sa définition.
7. **Les noms connus que la Publication dit** : pour chaque personne ou organisation déjà rencontrée dont le Raw ou le titre dit une forme, son nom canonique, puis les formes déjà vues (un nom de famille seul, un sigle, une faute des sous-titres).
8. **Le Raw** : la transcription telle qu'elle a été récupérée. Le plus souvent des blocs de 30 s, chacun ouvert par son horodatage (`12:30`, `1:02:30` au-delà d'une heure, ou `**[12:30](...)**` dans quelques vieux Raws). Certains Raws n'ont aucun horodatage.

Lancée à la main sur une Source, la skill lit les mêmes entrées à leur place : le Raw dans le bucket, le `CLAUDE.md` et le `source.yaml` du nœud de la Source sous `6-politics/2-sources/`, la fiche `Videos/` de son vault figé sous `Legacy/`, `vocabulaire.yaml` et `noms.yaml` dans `.vocabulaire/` de wikipol.

## Ce que tu rends

Le document seul, sans phrase avant ni après, sans bloc de code autour :

```markdown
---
preview: >-
  La thèse de la Publication en une ou deux phrases, 350 caractères au plus.
mentions:
  - {name: Pascal Boniface, kind: personne, labels: [chercheur], qualifiers: [animateur, intervenant]}
  - {name: Adama Traoré, kind: personne, labels: [témoin], qualifiers: [sujet], heard_as: Adam Traore}
  - {name: Assa Traoré, kind: personne, labels: [militant, porte-parole], qualifiers: [invité, intervenant]}
  - {name: Comité Vérité et Justice pour Adama, kind: organisation, labels: [collectif], qualifiers: [sujet]}
  - {name: Samir Elyes, kind: personne, labels: [militant], qualifiers: [mentionné], heard_as: Samir Elias, unsure: true}
relations:
  - {from: Assa Traoré, relation: dirige, to: Comité Vérité et Justice pour Adama}
new_terms:
  - {label: porte-parole, kind: personne, definition: "Parle au nom d'une organisation, d'une famille ou d'un mouvement."}
---
## 1. Première affirmation, en une phrase.

Une à trois phrases qui la développent, si elle en a besoin.

> [12:30](https://www.youtube.com/watch?v=YOUTUBE_ID&t=750s) « les mots exacts du Raw »

> [14:00](https://www.youtube.com/watch?v=YOUTUBE_ID&t=840s) « une deuxième citation, si elle ajoute »

## 2. Deuxième affirmation.

> [21:00](https://www.youtube.com/watch?v=YOUTUBE_ID&t=1260s) « ... »
```

Pour un Raw sans horodatage, un Extract n'a pas de lien : `> « les mots exacts du Raw »`.

`relations` et `new_terms` sont facultatifs : n'écris la clé que si elle a quelque chose. Une mention par ligne, entre accolades ; un nom qui porte une virgule, deux-points ou des crochets se met entre guillemets.

## Écrire

### Le Preview

La thèse, pas le sujet : *La PaduTeam soutient que le PS prépare 2027 en se recentrant, et que la gauche radicale doit l'en empêcher*, plutôt que *Une vidéo sur le PS*. Une ou deux phrases, 350 caractères au plus, espaces comprises.

### Les affirmations

- **De une à six**, numérotées `## 1.`, `## 2.`… dans l'ordre. Six est un plafond, pas un but : une capsule de cinq minutes en porte souvent deux ou trois.
- **Chacune est une thèse de la Source**, formulée dans ses termes, pas un thème (*Le RN progresse dans les campagnes parce que les services publics s'en retirent*, pas *Le RN et la ruralité*). Restituer, pas neutraliser : ne challenge pas, ne nuance pas ce que la Source ne nuance pas. Le `CLAUDE.md` de la Source précise comment.
- **Attribution : celle de la Source par défaut**, reçue avec la Publication : collective pour *la PaduTeam*, une personne pour *Pascal Boniface*. Nomme un autre intervenant seulement quand le Raw l'identifie clairement : il se présente, on l'appelle par son nom, ou le contexte éditorial le désigne.
- **Qui parle dans l'Extract parle dans l'affirmation.** Une émission de réaction diffuse les mots d'autres (un extrait commenté, un tweet lu à voix haute), une interview donne la parole à un invité, et une citation rapportée (« comme disait un analyste… ») appartient à son auteur. Une affirmation dont les Extracts sont les mots d'un autre lui est attribuée dans son titre (*Lio décrit…*, *Selon les auteurs…*, *L'invité soutient…*, *La vidéo commentée affirme…*), ou bien elle devient la thèse de la Source et ses Extracts sont alors la réaction de la Source elle-même. Même règle pour le Preview : n'y fais pas dire à la Source ce que dit un autre.
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

### Les mentions

Les mentions disent qui et quoi la Publication nomme, sous le nom qu'un lecteur cherchera. Le pipeline les recopie dans le frontmatter du Digest et les vérifie contre le vocabulaire et le Raw.

- **Ce qui est une mention** : ce dont la Publication parle, ce qu'elle cite (un livre, un tweet, un extrait diffusé), et qui parle dedans. Pas un nom égrené dans une liste, pas un sponsor, pas un appel à s'abonner, pas la chaîne elle-même quand elle se nomme en passant. Une personne, une organisation, un lieu, un événement, une œuvre ou un texte : un des six kinds du vocabulaire. Les concepts et les thèmes n'en sont pas.
- **Une mention par entité**, même si elle revient sous plusieurs noms (*Mélenchon*, *Jean-Luc Mélenchon*, *JLM*) : une seule entrée, au nom canonique.
- **`kind`** : un des kinds du vocabulaire.
- **`labels`** : ce qu'elle est **à la date de la Publication**, pas aujourd'hui : un ministre de 2019 reste `ministre` dans un Digest de 2019. Une fonction, jamais un jugement : `groupe-armé`, pas `terroriste` ; `élu`, pas `démagogue`. Le jugement de la Source reste dans ses affirmations. Aucun, un ou plusieurs ; aucun quand on ne sait pas.
- **`qualifiers`** : ce qu'elle est **pour la Publication**. `intervenant` pour chaque voix qu'on entend dans le Raw et qu'on sait nommer : un animateur déclaré, une personne qui se présente, qu'on appelle par son nom, ou que le titre annonce comme invitée. Les sous-titres ne disent pas qui parle : une voix qu'on ne sait pas nommer n'est pas une mention. `animateur` pour qui mène la Publication, `invité`, `cité` pour des mots lus ou diffusés sans que la personne intervienne, `sujet` pour ce dont elle parle, `mentionné` pour ce qu'elle nomme brièvement dans son argument.
- **`relations`** : seulement quand le Raw les dit (*Assa Traoré, qui préside le comité…*), entre deux mentions du Digest, nommées par leur `name` tel que la mention l'écrit, et d'un kind que la relation admet. Pas une relation que tu sais mais que la Publication ne dit pas.
- **Un terme qui manque.** Quand aucun label, qualifier ou relation du vocabulaire ne convient, tu peux en employer un nouveau, à condition de le déclarer dans `new_terms` avec une définition d'une ligne : `{label: <terme>, kind: <kind>, definition: "…"}`, `{qualifier: <terme>, kind: <kind>, definition: "…"}`, ou `{relation: <terme>, from: [<kinds>], to: [<kinds>], definition: "…"}`. Un terme s'écrit en minuscules, les mots liés par des tirets (`chef-d-état`). Le pipeline l'ajoute au vocabulaire, `proposé`. Préfère un terme existant qui convient à peu près : un nouveau terme se justifie par un manque, pas par une nuance.

### Les noms canoniques

Les sous-titres de YouTube écorchent les noms (*Adam Traore* pour Adama Traoré, *Bezano* pour Besancenot). Le `name` d'une mention est le nom canonique, bien orthographié, accents compris :

- **Corrige à partir de** ce que tu reçois, dans cet ordre : la liste des noms connus (son nom canonique d'abord), le titre de la vidéo, le contexte éditorial (qui anime la chaîne), la fiche legacy, puis ce que tu sais du monde.
- **`heard_as`** : l'orthographe des sous-titres, recopiée telle quelle, quand elle diffère du `name` (*Adam Traore*). Le validateur cherche ce `heard_as`, ou à défaut le `name`, dans le Raw ou le titre, à la casse, aux accents et à la ponctuation près : une mention que ni le Raw ni le titre ne disent sous l'une de ces formes est refusée, sauf un animateur déclaré de la Source.
- **`unsure: true`** quand tu n'es pas sûr du nom canonique : un nom rare, une transcription trop abîmée, deux personnes possibles. Mieux vaut un nom marqué incertain qu'un nom inventé ; ne mets la clé que pour `true`.

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
- une mention a un kind, un label ou un qualifier hors du vocabulaire (ou un terme retiré), n'est dite sous son `heard_as` ou son `name` ni dans le Raw ni dans le titre (sauf un animateur déclaré), ou revient deux fois ; une relation relie autre chose que deux mentions du Digest, ou des kinds qu'elle n'admet pas ;
- un terme de `new_terms` est mal formé, sans définition d'une ligne, ou retiré ;
- du texte apparaît avant la première affirmation, ou un titre autre que `## <n>. <affirmation>`.

Un refus te revient une fois, avec la liste des points à corriger : réécris alors le document entier.
