# BUILD.md — Conventions universelles WikiPol

Ce fichier documente **comment** un vault WikiPol est construit : architecture des skills, invariants de nommage et de format, workflow git. Les skills individuelles (dans `Skills/`) décrivent leur workflow spécifique ; ce fichier contient les invariants communs à toutes les sources.

La **taxonomie concrète** (domaines, thèmes, enjeux) n'est pas définie ici : elle est propre à chaque source et vit dans `Legacy/<NomSource>/BUILD.md`.

Depuis WIK-1, les vaults sont figés dans `Legacy/` et chaque Source est un nœud de `6-politics/2-sources/` (`CLAUDE.md` éditorial, `source.yaml`, `1-chronicle/`, `.skills/`). Les sections « Le Digest » et « La Chronicle » ci-dessous décrivent ce que le pipeline de wikipol écrit dans une Chronicle. Le reste du fichier décrit comment les vaults legacy ont été construits : leurs chemins (`Sources/Transcripts/`, `Videos/`…) restent relatifs au dossier du vault.

---

## Le Digest

Un Digest résume une Publication : sa thèse, ses affirmations, chacune appuyée par des Extracts de son Raw (les mots sont ceux de `CONTEXT.md`). C'est une Leaf de sa Period, un fichier `N-<slug>.md` de la Chronicle de la Source, en français. `wikipol digest` l'écrit avec la skill [[6-politics/1-projects/1-wikipol/Skills/write-digest/SKILL|write-digest]] et le vérifie avant de le garder ; `wikipol check-digest` revérifie un fichier existant contre son Raw. Le format est tenu par `Scripts/src/wikipol/digest/format.py` : ce qui suit et ce module disent la même chose.

### Forme fichier

```markdown
---
title: "MBAPPÉ TRAITE MAO DE DICTATEUR ET SE FAIT PURGER DU RÉAL (basé) !!"
parent: 6-politics/2-sources/1-paduteam/1-chronicle/<la Period>
owner: diplo
preview: >-
  La thèse, en une ou deux phrases, 350 caractères au plus.
source: paduteam
url: https://www.youtube.com/watch?v=URonNSP0qM0
youtube_id: "URonNSP0qM0"
published: 2026-10-30
duration: 3447
raw: paduteam/URonNSP0qM0.md
ingested: 2026-10-31
digest_version: 1
model: claude-sonnet-5-5
---
# MBAPPÉ TRAITE MAO DE DICTATEUR ET SE FAIT PURGER DU RÉAL (basé) !!

## 1. Une affirmation de la Source, en une phrase.

Une à trois phrases qui la développent, facultatives, avec au besoin un [[chemin/d-un/autre-digest|lien vers un autre Digest]].

> [1:35](https://www.youtube.com/watch?v=URonNSP0qM0&t=95s) « les mots exacts du Raw »

> [5:12](https://www.youtube.com/watch?v=URonNSP0qM0&t=312s) « une deuxième citation »

## 2. ...
```

Le frontmatter porte les quatre champs du dépôt (`title`, `parent`, `owner`, `preview`), puis ceux du Digest, tous présents :

| Champ | Contient |
|---|---|
| `title` | Le titre de la vidéo, celui des métadonnées du Raw ; c'est aussi le titre `#` du corps |
| `parent` | Le dossier de la Period qui le contient, depuis la racine du dépôt |
| `preview` | La thèse de la Publication, 350 caractères au plus |
| `source` | Le slug de la Source |
| `url` | `https://www.youtube.com/watch?v=<youtube_id>` |
| `youtube_id` | L'identifiant YouTube, entre guillemets (il peut commencer par `-`) |
| `published` | La date de publication, ou `null` quand ni le Raw ni la fiche legacy ne la connaissent |
| `duration` | La durée en secondes, ou `null` : seuls les Raws du Fetcher la connaissent |
| `raw` | La clé du Raw dans le bucket, `<source>/<youtube_id>.md` |
| `ingested` | La date d'écriture du Digest |
| `digest_version` | La version du format et de la skill, un entier ; `1` aujourd'hui, incrémenté quand ce qu'un Digest dit change |
| `model` | Le modèle qui l'a écrit : l'identifiant épinglé dans le `source.yaml` de la Source |

Le corps : le titre, puis **une à six affirmations** `## <n>. <affirmation>`, numérotées dans l'ordre, rien d'autre sous le titre. Chacune porte **une à trois Extracts**, une ligne chacune, séparées par une ligne vide : `> [<horodatage>](<url>&t=<secondes>s) « <citation> »`. La citation est un passage continu du Raw, cinq mots au moins ; le lien ouvre la vidéo au début du bloc de 30 s où elle commence, une seconde que le Raw porte, avant la fin de la vidéo. Un Raw sans horodatage (deux aujourd'hui, `wsiChBGb6T0` et `xnU_T2a6Nz0`) donne des Extracts sans lien : `> « <citation> »`. Des mots entre « » ailleurs, dans le Preview ou un développement, citent aussi la Source et doivent être dans le Raw. Un Digest en cite un autre de sa Source par wikilink, `[[<chemin du Digest sans .md>|<libellé>]]`, et seulement un Digest qui existe.

### Forme app

Dans hexframe, un Digest est un Tile : `title` et `preview` deviennent son titre et son Preview, et son Body s'ouvre sur les champs du Digest en bloc YAML, avant les affirmations :

````markdown
```yaml
source: paduteam
url: https://www.youtube.com/watch?v=URonNSP0qM0
youtube_id: "URonNSP0qM0"
published: 2026-10-30
duration: 3447
raw: paduteam/URonNSP0qM0.md
ingested: 2026-10-31
digest_version: 1
model: claude-sonnet-5-5
```

## 1. Une affirmation de la Source, en une phrase.
...
````

`parent` et `owner` ne passent pas : la place du Tile dans la carte les remplace. La synchronisation du dépôt vers l'app viendra hors de ce projet.

### Le modèle, épinglé

`claude.default_model` du `source.yaml` de chaque Source (et du gabarit `Templates/source.yaml.tmpl`) donne l'identifiant du modèle qui écrit ses Digests, `claude-sonnet-5-5` aujourd'hui. `wikipol digest` le passe tel quel à `claude -p --model` et le recopie dans le champ `model`. Un alias (`sonnet`, `opus`) ou un `-latest` est refusé dès la lecture du `source.yaml` : il glisserait vers un modèle plus récent sans prévenir, et un Digest doit dire ce qui l'a écrit. Changer de modèle, c'est changer cette ligne, et les Digests écrits avant gardent leur `model`.

---

## La Chronicle

La Chronicle d'une Source, `1-chronicle/`, range ses Digests par date en un arbre de Periods qui se divisent par nombre ([[6-politics/1-projects/1-wikipol/docs/adr/0001-chronicle-splits-by-count|ADR 0001]]). `wikipol file` y range des Digests et fait réécrire par la skill [[6-politics/1-projects/1-wikipol/Skills/write-period/SKILL|write-period]] chaque Period touchée. Les règles sont tenues par `Scripts/src/wikipol/chronicle/` : ce qui suit et ce paquet disent la même chose.

### La forme de l'arbre

- **Une Period** est un dossier et son `CLAUDE.md`. Elle tient soit jusqu'à six Digests, soit jusqu'à six Periods plus courtes, jamais les deux. La Chronicle elle-même en est la racine.
- **Ranger un Digest** descend vers la Period dont les dates l'accueillent : la dernière qui commence au plus tard à sa date, sinon la première. Il y prend sa place par date (puis par `youtube_id` entre deux Digests du même jour).
- **Une Period qui déborde** (sept enfants) se coupe en deux, de quatre et trois, au milieu ; quand l'autre milieu tombe entre deux dates différentes et celui-là non, c'est l'autre. La seconde moitié devient une Period sœur, juste après ; le parent peut déborder à son tour. La Chronicle n'a pas de sœur : quand elle déborde, ses enfants descendent dans deux nouvelles Periods sous elle. Tous les Digests restent ainsi à la même profondeur, et les dates de deux Periods sœurs ne se chevauchent pas.
- **Un Digest sans date** (`published: null`) n'a pas de place : `wikipol file` le refuse. Un Digest déjà rangé et rangé de nouveau à la même date remplace l'ancien ; à une autre date, il est refusé.

### Noms, titres, liens

Les enfants sont numérotés de 1 à 6 dans l'ordre des dates. Un Digest est le fichier `N-<slug>.md`, le slug fait des six premiers mots de son titre, sans accents ; une Period est le dossier `N-<sa première date>`, par exemple `2-2026-01-05/`. Le titre d'une Period est sa plage de dates, `2026-01-05 → 2026-01-07` (une seule date quand tous ses Digests sont du même jour) ; la Chronicle garde le sien.

Ranger un Digest peut en déplacer d'autres : une coupe, une renumérotation. Le `parent` de chaque fichier déplacé suit, et chaque wikilink qui nommait un Digest ou une Period déplacée (par son `CLAUDE`) est réécrit : dans la Chronicle, et dans tous les fichiers Markdown du dépôt, hors dossiers cachés, `node_modules/` et les vaults figés de `Legacy/`.

### Le fichier d'une Period

```markdown
---
title: "2026-01-05 → 2026-01-07"
parent: 6-politics/2-sources/1-paduteam/1-chronicle/2-2026-01-05
owner: diplo
preview: >-
  Ce que la Source a soutenu pendant ces dates, 350 caractères au plus.
---
# 2026-01-05 → 2026-01-07

Un à trois paragraphes : le résumé de la Period.

## Contenu

1. [[6-politics/2-sources/1-paduteam/1-chronicle/2-2026-01-05/1-titre-de-la-video|TITRE DE LA VIDÉO]] (2026-01-05)
2. ...
```

Le pipeline écrit le frontmatter, le titre et la liste `## Contenu` (pour une Period de Periods : `[[<dossier>/CLAUDE|<plage>]] (<n> Digests)`). `write-period` écrit le Preview et le résumé, à partir des titres et des Previews de ses enfants seulement, via `claude -p` sur le modèle épinglé dans le `source.yaml`. Le résumé est refusé s'il est vide, dépasse trois paragraphes, porte un titre ou une citation en bloc, lie autre chose qu'un enfant, ou met entre « » des mots qu'aucun titre ni Preview d'enfant ne contient ; refusé, il revient une fois au modèle, et un second refus n'écrit rien.

Les Periods touchées sont celles dont les enfants ont changé : celles au-dessus du Digest rangé, et celles qu'une coupe a créées. Elles sont résumées de la plus profonde à la Chronicle, pour qu'un parent lise les Previews déjà réécrits de ses enfants. Tout est calculé avant d'écrire : un résumé qui échoue laisse la Chronicle telle qu'elle était. Une Period que le rangement n'a pas touchée garde son résumé.

---

## Architecture des skills

```
┌──────────────────────────────────────────────────────┐
│  ingest-batch (optionnel)                            │
│  Regroupe N transcripts par sujet, dispatche vers    │
│  des subagents dédiés (un par vidéo) pour préserver  │
│  la finesse analytique. Un seul commit / PR.         │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  ingest-video (orchestrateur principal)               │
│  1. Lit le transcript                                │
│  2. Appelle gather-context pour le sujet             │
│  3. Dispatche vers les skills write-* selon les      │
│     content_types activés dans source.yaml           │
│  4. Gère le git (branche, commit, PR vers main)      │
└───────┬──────────────────┬─────────────────┬─────────┘
        │                  │                 │
        ▼                  ▼                 ▼
   basics             advanced           (consolidation
   write-video        write-enjeu         finale, batch)
   write-book         write-conjoncture
   write-entity       write-possible
   write-concept      write-methode
   write-evenement
```

### Principe central : séparer contexte et écriture

Chaque skill spécialisée (`write-*`) reçoit en entrée :
- Le **contexte** rassemblé par `gather-context` (fiches vault existantes, vidéos liées, entités connexes)
- Les **fiches existantes** pertinentes (déjà lues)
- Les **instructions d'écriture** spécifiques à son type

Elle ne fait **pas** de recherche extensive. Elle prend le contexte pour acquis et se concentre sur la rédaction.

### Skills

| Skill | Rôle | Tier de la fiche produite |
|-------|------|---------------------------|
| `gather-context` | Rassembler tout ce que le vault sait sur un sujet donné | — (lecture seule) |
| `ingest-video` | Orchestrer l'ingestion d'un transcript | — (orchestration) |
| `ingest-batch` | Ingérer plusieurs transcripts par sujet pour cohérence maximale | — (orchestration) |
| `write-video` | Rédiger/enrichir une fiche `Videos/` (cas standard) | basic |
| `write-book` | Rédiger/enrichir une fiche `Livres/` (chronique d'ouvrage, remplace `write-video`) | basic |
| `write-entity` | Rédiger/enrichir une fiche `Individus/` ou `Organisations/` | basic |
| `write-concept` | Rédiger/enrichir une fiche `Concepts/` | basic |
| `write-evenement` | Rédiger/enrichir une fiche `Evenements/` | basic |
| `write-enjeu` | Rédiger/enrichir une fiche `Enjeux/` | advanced |
| `write-conjoncture` | Rédiger/enrichir une fiche `Conjonctures/` | advanced |
| `write-possible` | Rédiger/enrichir une fiche `Possibles/` | advanced |
| `write-methode` | Rédiger/enrichir une fiche `Methodes/` | advanced |

Une skill `write-*` ne doit s'exécuter que si son type est activé dans `content_types` du `source.yaml` actif (voir « Classification des types de contenu » ci-dessous). Si elle est invoquée pour un type désactivé, elle interrompt et signale à l'appelant de réactiver le type ou de choisir une autre skill.

---

## Classification des types de contenu

Trois tiers structurent les fiches du vault. La distinction conditionne **quand** une fiche est créée et **par quoi** elle est créée.

### Raw (brut)

Données captées hors analyse de la source. Servent de matière première à l'ingestion.

- **Transcripts** — transcripts `.md` des médias source (vidéos YouTube, podcasts, articles transcrits). Stockés sous `Sources/Transcripts/`, hors git. Depuis WIK-2, ce sont les Raws du bucket Scaleway ; Google Drive n'en garde qu'une archive, et les 12 transcripts que la copie n'a pas pu identifier (voir `CLAUDE.md` de WikiPol § Raws).

### Basic (atomique)

Créés **pendant l'ingestion d'un transcript**, fiche par fiche, à partir de ce que la source dit. Atomiques, factuels, directement extraits.

- **Individus** — personnes mentionnées et analysées par la source.
- **Organisations** — partis, médias, associations, États, etc.
- **Concepts** — outils analytiques mobilisés par la source (mécanismes, grilles de lecture, terminologie).
- **Videos** — fiche par vidéo ingérée (cas standard : analyse, commentaire d'actualité).
- **Livres** — fiche par livre chroniqué quand la vidéo est une « chronique d'ouvrage » (remplace la fiche Vidéo).
- **Evenements** — occurrences singulières datées que la source analyse (élection, manifestation, vote, sommet, attentat).

### Advanced (synthétique)

Construits **à partir des fiches basic existantes**, par synthèse multi-vidéos. Théoriques, prescriptifs, rarement créés en passe unique.

- **Enjeux** — combats stratégiques récurrents que la source défend (3+ vidéos avec position constante).
- **Conjonctures** — diagnostics du moment historique que la source pose (états transitoires : crise X, basculement Y, recomposition Z).
- **Possibles** — trajectoires alternatives que la source imagine explicitement (contrefactuel ou programmatique).
- **Methodes** — procédures analytiques réutilisables que la source enseigne ou applique (matérialisme historique, lecture de bloc, etc.).

### Pourquoi cette stratification

- Les **basics** existent pour qu'on puisse en parler par wikilink — chaque fois qu'une source mentionne quelque chose qui mérite une fiche, on en crée une.
- Les **advanced** existent pour qu'on puisse poser une question de synthèse au vault — « quel est le combat de la source sur X ? » → fiche Enjeu ; « quelle méthode mobilise-t-elle ? » → fiche Methode.
- Le **raw** est ce qui rend l'ingestion auditable : on peut toujours retrouver le passage source d'une affirmation.

### Activation par source

Toutes les sources n'utilisent pas tous les types. Le `source.yaml` de la Source déclare ses `content_types` activés (whitelist stricte) ; les skills `write-*` refusent d'écrire un type désactivé.

---

## Invariants — Règles communes à toutes les skills et toutes les sources

### Attribution

L'attribution par défaut est collective — elle désigne la source (ex : "la chaîne", "les auteurs", nom collectif défini dans `source.yaml:source.attribution`). N'attribuer individuellement que quand c'est explicitement identifiable dans le transcript (segment solo, auto-identification, rôle reconnu).

Le ton et les principes d'attribution spécifiques à une source sont définis dans le `CLAUDE.md` de la Source (`6-politics/2-sources/<n>-<slug>/`).

### Noms de fichiers

- Pas d'accents ni de caractères spéciaux dans les noms de fichiers
- Les noms accentués sont définis en `aliases` dans le frontmatter
- **Individus** : Prénom Nom (`Jean-Luc Melenchon.md`)
- **Organisations** : Nom officiel complet (`France Insoumise.md`, pas `LFI.md`)
- **Concepts** : Nom descriptif capitalisé (`Eclatement du bloc central.md`)
- **Enjeux** : Nom court du combat (`Plus jamais PS.md`)
- **Vidéos** : Titre abrégé lisible (`COMMENT MELENCHON VA GAGNER EN 2027 AU SECOND TOUR.md`)

### Wikilinks

- `[[Nom Exact du Fichier]]` sans chemin, sans `.md`
- Pour les alias : `[[Nom réel|alias affiché]]` (ex: `[[Parti Communiste Français|PCF]]`)
- Le nom du fichier = le texte du wikilink
- Chaque wikilink doit pointer vers un fichier existant. Si un lien orphelin est créé, créer au minimum une fiche ébauche.

### YAML frontmatter — règles communes

Toujours inclure au minimum :
- `type` : voir la table par type ci-dessous (`vidéo`, `livre`, `individu`, `organisation`, `concept`, `evenement`, `enjeu`, `conjoncture`, `possible`, `methode`, `transcript`).
- `domaine` : 1-2 valeurs parmi celles définies dans le `BUILD.md` de la source.
- `thèmes` : liste de thèmes du vocabulaire contrôlé local (peut être vide pour les fiches squelettes).
- `skill_version` : identifiant de la skill + date (ex: `write-video-2026-04-20`).

Cette section liste, **par type**, les champs requis et optionnels — c'est la référence pour les skills d'écriture **et** pour les agents qui font des recherches par grep sur le frontmatter (ex : `grep -l "type: enjeu"` dans `Enjeux/`).

### Frontmatter par type

#### Transcript (raw)

Stockés dans `Sources/Transcripts/`. Le frontmatter est minimal car les transcripts ne sont pas indexés ni traversés par `gather-context`.

- **Requis** : `type: transcript`, `date` (date de publication du média), `youtube_id` (ou identifiant équivalent pour la plateforme source).
- **Optionnels** : `titre_video` (si différent du basename), `aliases`.

```yaml
---
type: transcript
date: 2025-07-30
youtube_id: "XXXXXXXXXXX"
---
```

#### Vidéo (basic)

Stockés dans `Videos/`. Cas par défaut produit par `write-video`.

- **Requis** : `type: vidéo`, `domaine`, `thèmes`, `enjeux` (peut être vide), `date`, `youtube_id`, `skill_version`.
- **Optionnels** : `aliases`.

```yaml
---
type: vidéo
domaine: [politique-intérieure]
thèmes: [élections]
enjeux: [union-populaire]
date: 2025-07-30
youtube_id: "XXXXXXXXXXX"
skill_version: write-video-2026-04-20
aliases: [Titre alternatif]
---
```

#### Livre (basic)

Stockés dans `Livres/`. Produits par `write-book` quand une vidéo est une chronique d'ouvrage (remplace la fiche Vidéo).

- **Requis** : `type: livre`, `domaine`, `thèmes`, `enjeux`, `livre_auteur`, `livre_titre`, `livre_annee`, `date_video`, `youtube_id`, `skill_version`.
- **Optionnels** : `livre_editeur`, `aliases`.

```yaml
---
type: livre
domaine: [géopolitique]
thèmes: [moyen-orient]
enjeux: []
livre_auteur: "Didier Billion"
livre_titre: "Géopolitique des mondes arabes"
livre_annee: 2024
livre_editeur: "Eyrolles"
date_video: 2026-04-15
youtube_id: "XXXXXXXXXXX"
skill_version: write-book-2026-04-20
aliases: [Géopolitique des mondes arabes]
---
```

#### Individu (basic)

Stockés dans `Individus/`. Produits par `write-entity`.

- **Requis** : `type: individu`, `domaine`, `thèmes`, `skill_version`.
- **Optionnels** : `aliases` (très recommandé pour gérer accents et variantes de nom).

```yaml
---
type: individu
domaine: [politique-intérieure]
thèmes: [élections, guerre-des-gauches]
aliases: [François Hollande]
skill_version: write-entity-2026-04-20
---
```

#### Organisation (basic)

Stockés dans `Organisations/`. Produits par `write-entity`.

- **Requis** : `type: organisation`, `domaine`, `thèmes`, `skill_version`.
- **Optionnels** : `aliases`.

```yaml
---
type: organisation
domaine: [politique-intérieure]
thèmes: []
aliases: [PS, Parti Socialiste]
skill_version: write-entity-2026-04-20
---
```

#### Concept (basic)

Stockés dans `Concepts/`. Produits par `write-concept`.

- **Requis** : `type: concept`, `domaine`, `thèmes`, `skill_version`.
- **Optionnels** : `aliases`, `couche` (si la source utilise des vues filtrées sur les concepts — valeurs : `methode | conjoncture | possible`).

```yaml
---
type: concept
domaine: [théorie]
thèmes: [élections]
aliases: [Saint Graphique, Le Graphique]
skill_version: write-concept-2026-04-20
---
```

#### Evenement (basic)

Stockés dans `Evenements/`. Produits par `write-evenement`. Une fiche Evenement existe pour un fait daté **analysé en profondeur** par la source — pas pour chaque date mentionnée.

- **Requis** : `type: evenement`, `domaine`, `thèmes`, `date_debut`, `skill_version`.
- **Optionnels** : `date_fin` (si l'événement s'étale dans le temps), `lieu`, `acteurs` (liste de wikilinks vers Individus/Organisations principaux), `aliases`.

```yaml
---
type: evenement
domaine: [politique-intérieure]
thèmes: [élections]
date_debut: 2025-07-30
date_fin: 2025-08-02
lieu: "Paris"
acteurs: ["[[Jean-Luc Melenchon]]", "[[France Insoumise]]"]
skill_version: write-evenement-2026-04-26
---
```

Organisable par période en sous-dossiers (ex: `Evenements/2026/`, `Evenements/1950-1979/`) si le volume le justifie.

#### Enjeu (advanced)

Stockés dans `Enjeux/`. Produits par `write-enjeu` à partir des fiches Vidéos/Livres/Concepts existantes.

- **Requis** : `type: enjeu`, `domaine`, `thèmes`, `skill_version`.
- **Optionnels** : `aliases`.

```yaml
---
type: enjeu
domaine: [politique-intérieure]
thèmes: [guerre-des-gauches, élections]
skill_version: write-enjeu-2026-04-24
---
```

#### Conjoncture (advanced)

Stockés dans `Conjonctures/`. Produits par `write-conjoncture`. Une Conjoncture est un **diagnostic du moment historique** que la source pose explicitement (état transitoire, crise nommée, basculement diagnostiqué).

- **Requis** : `type: conjoncture`, `domaine`, `thèmes`, `statut` (valeurs : `ouverte | confirmée | infirmée | dépassée`), `skill_version`.
- **Optionnels** : `horizon` (date jusqu'à laquelle la conjoncture est censée tenir), `aliases`.

```yaml
---
type: conjoncture
domaine: [géopolitique]
thèmes: [États-Unis, Chine]
statut: ouverte
horizon: 2030-12-31
skill_version: write-conjoncture-2026-04-26
---
```

#### Possible (advanced)

Stockés dans `Possibles/`. Produits par `write-possible`. Un Possible est une **trajectoire alternative explicitement imaginée** par la source — soit contrefactuel (« qu'aurait-il fallu faire en 2017 »), soit programmatique (« ce que serait une France X au pouvoir »).

- **Requis** : `type: possible`, `domaine`, `thèmes`, `nature` (valeurs : `contrefactuel | programmatique`), `skill_version`.
- **Optionnels** : `acteurs_pivots` (liste de wikilinks), `horizon` (date), `aliases`.

```yaml
---
type: possible
domaine: [société]
thèmes: [abondance, écologie]
nature: programmatique
acteurs_pivots: ["[[La Brèche]]"]
skill_version: write-possible-2026-04-26
---
```

#### Methode (advanced)

Stockés dans `Methodes/`. Produits par `write-methode`. Une Méthode est une **procédure analytique réutilisable** que la source enseigne ou applique systématiquement (pas une simple grille de lecture — c'est un how-to, pas un what-is, qui est lui un Concept).

- **Requis** : `type: methode`, `domaine`, `thèmes`, `skill_version`.
- **Optionnels** : `etapes` (liste ordonnée d'étapes courtes en frontmatter, pour grep), `aliases`.

```yaml
---
type: methode
domaine: [théorie]
thèmes: [analyse-de-classe]
etapes:
  - "Identifier la PCS dominante du bloc"
  - "Repérer les fractures internes"
  - "Cartographier les alliances de classe"
skill_version: write-methode-2026-04-26
---
```

---

### Champ `content_types` du `source.yaml`

Chaque source déclare ses types actifs dans son `source.yaml` (`6-politics/2-sources/<n>-<slug>/source.yaml`). C'est une **whitelist stricte** : les skills `write-*` refusent d'écrire un type désactivé.

```yaml
content_types:
  raw:
    Transcripts: true
  basic:
    Individus: true
    Organisations: true
    Concepts: true
    Videos: true
    Livres: false
    Evenements: false
  advanced:
    Enjeux: true
    Conjonctures: false
    Possibles: false
    Methodes: false
```

Les sources peuvent activer un type plus tard ; il suffit d'éditer `source.yaml` et de créer le dossier (manuellement ou via un script utilitaire). Désactiver un type **n'efface pas** les fiches existantes — il bloque seulement la création de nouvelles fiches par les skills.

### Hashtags inline

Après le frontmatter YAML, les fiches incluent une ligne de hashtags structurés avant le titre `# Titre` :

```
#domaine/valeur #thème/valeur #enjeu/valeur
```

Inclure uniquement domaine, thèmes et enjeux (pas format ni statut). Ces hashtags matérialisent les tags comme nœuds du graphe Obsidian.

### Taxonomie des tags

3 axes structurent le tagging :

1. **domaine** — champ d'analyse (liste finie, définie par la source)
2. **thèmes** — sujets spécifiques récurrents (vocabulaire contrôlé, extensible par la source)
3. **enjeux** — combats stratégiques récurrents (définis par la source)

Les valeurs concrètes de ces axes sont déclarées dans `Legacy/<NomSource>/BUILD.md`. Elles croissent **par induction** au fil des ingestions : ajouter un nouveau thème si un sujet revient dans 2+ vidéos, un nouvel enjeu si un combat revient dans 3+ vidéos avec une position constante.

### Sourcing YouTube

Les fiches vidéo incluent un lien YouTube embarqué en haut (avant le résumé) et des notes de bas de page avec timestamps pour sourcer les points clés.

**Lien embarqué** (en haut de chaque fiche vidéo, après les hashtags, avant le `# Titre`) :
```markdown
![TITRE](https://www.youtube.com/watch?v=YOUTUBE_ID)
```

Obsidian reconnaît cette syntaxe image pointant vers une URL YouTube et affiche un lecteur embarqué. Ne **pas** utiliser de thumbnail cliquable via `img.youtube.com` — cette forme donne une image statique sans lecteur.

**Notes de bas de page avec timestamp** (dans le corps des fiches — vidéos, entités, concepts, enjeux) :
```markdown
La source affirme que X est structurellement incapable de Y[^1].

[^1]: [12:34](https://www.youtube.com/watch?v=YOUTUBE_ID&t=754) — "citation exacte ou résumé du passage"
```

Le `youtube_id` est stocké dans le frontmatter de la fiche vidéo. Pour convertir un timestamp `MM:SS` en secondes, utiliser le helper `Scripts/timestamp_to_seconds.py`.

Pour les fiches non-vidéo (entités, concepts, enjeux), les footnotes référencent la vidéo source via son `youtube_id` — récupéré depuis la fiche vidéo correspondante.

### Style

- Phrases courtes, pas de remplissage
- Ton analytique, pas encyclopédique
- Fidélité à l'analyse de la source — restituer, pas neutraliser

Les principes éditoriaux spécifiques (restituer sans challenger, nuancer, contextualiser, etc.) sont définis dans le `CLAUDE.md` de la Source (`6-politics/2-sources/<n>-<slug>/`) selon la nature de la source.

### Volume

Être ambitieux dans la création de fiches. Chaque personne mentionnée significativement, chaque organisation citée, chaque mécanisme analytique décrit mérite sa fiche. Il vaut mieux créer une fiche minimale (ébauche) que de laisser un lien orphelin.

---

## Workflow git

WikiPol et toutes ses sources vivent dans le dépôt `Diplow/diplow`, sous `6-politics/1-projects/1-wikipol/`. Il n'y a ni dépôt par source, ni branche `develop` : tout arrive sur `main` par une pull request, jamais par un push direct (règle du dépôt, voir `STACK.md` à sa racine).

### Branches

```
main                                ← état courant du vault ; jamais de push direct
 ├── ingest/<slug-video>            ← ingestion unitaire (1 vidéo)
 └── ingest-batch/<slug-sujet>      ← ingestion batch (N vidéos d'un même sujet)
```

- **`ingest/<slug>`** : ingestion unitaire. Slug = slug de la source puis titre de la vidéo, en minuscules, sans accents, tirets, tronqué à ~50 chars.
- **`ingest-batch/<slug>`** : batch thématique. Slug = champ `Slug branche` du fichier de suivi (ex: `paduteam-2024-w47-w48`), ~40 chars max. Un seul commit par batch.

### En début d'ingestion

1. `git branch --show-current`. Si la branche courante n'est pas `main` (workspace Conductor, ou branche ouverte par un batch précédent du même run `Scripts/run_ingest.py`), travailler dessus : les batches successifs s'y empilent, un commit chacun, dans une seule PR.
2. Sinon, partir de `main` à jour : `git fetch origin && git checkout -b ingest/<slug> origin/main` (ou `ingest-batch/<slug>`).

### En fin d'ingestion

1. Stage les fichiers modifiés/créés par nom, tous sous le dossier du vault (pas `git add -A`)
2. Commit avec message structuré :
   ```
   ingest: TITRE ABRÉGÉ DE LA VIDÉO

   Fiches créées: X (liste)
   Fiches enrichies: Y (liste)
   Corrections ortho: Z (liste si applicable)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
   Préfixes : `ingest:` (1 vidéo), `ingest-batch:` (batch), `synthesize: COUCHE — Nom cible` (synthèse).
3. Push : `git push -u origin HEAD`
4. Si la branche n'a pas encore de PR (`gh pr view` échoue), en ouvrir une vers `main` : `gh pr create --base main`, titre = première ligne du commit, corps = résumé d'ingestion. Sinon le push suffit, la PR existante se met à jour.
5. Ne jamais merger soi-même : l'utilisateur relit la PR et la merge.

---

## Chemins d'une Source et de son vault legacy

```
6-politics/2-sources/<n>-<slug>/  ← le nœud de la Source
├── CLAUDE.md                     ← contexte éditorial de la source
├── source.yaml                   ← config paramétrique (content_types, git, model, legacy.vault)
├── 1-chronicle/                  ← les Digests, rangés par date en Periods
└── .skills/                      ← (optionnel) skills propres à la source qui surchargent
    └── <groupe>/<skill-name>/SKILL.md  les skills génériques de WikiPol/Skills/

6-politics/1-projects/1-wikipol/Legacy/<NomSource>/  ← le vault, figé
├── BUILD.md                      ← taxonomie locale
├── Sources/
│   ├── Inventaire.md             ← table des vidéos (Dataview)
│   └── Transcripts/              ← transcripts bruts (.md) — type raw, hors git (les Raws du bucket)
├── Videos/                       ← basic (cas standard)
├── Livres/                       ← basic (chronique d'ouvrage, remplace Videos pour ce format)
├── Individus/                    ← basic
├── Organisations/                ← basic
├── Concepts/                     ← basic
├── Evenements/                   ← basic (optionnel ; sous-dossiers par période possibles)
├── Enjeux/                       ← advanced
├── Conjonctures/                 ← advanced (optionnel)
├── Possibles/                    ← advanced (optionnel)
├── Methodes/                     ← advanced (optionnel)
└── <SLUG>_CHRONOLOGIQUE.md       ← fichier de suivi d'ingestion batch
```

Les dossiers marqués « optionnel » ne sont créés que si activés dans `source.yaml:content_types`.
