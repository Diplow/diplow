# BUILD.md — Conventions universelles WikiPol

Ce fichier documente **comment** un vault WikiPol est construit : architecture des skills, invariants de nommage et de format, workflow git. Les skills individuelles (dans `Skills/`) décrivent leur workflow spécifique ; ce fichier contient les invariants communs à toutes les sources.

La **taxonomie concrète** (domaines, thèmes, enjeux) n'est pas définie ici : elle est propre à chaque source et vit dans `Sources/<NomSource>/BUILD.md`.

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
│  4. Gère le git (branche, commit, PR)                │
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

- **Transcripts** — transcripts `.md` des médias source (vidéos YouTube, podcasts, articles transcrits). Stockés sous `Sources/Transcripts/`.

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

Toutes les sources n'utilisent pas tous les types. Le fichier `Sources/<NomSource>/source.yaml` déclare ses `content_types` activés (whitelist stricte). `Scripts/new_source.py` ne crée que les dossiers correspondants ; les skills `write-*` refusent d'écrire un type désactivé.

---

## Invariants — Règles communes à toutes les skills et toutes les sources

### Attribution

L'attribution par défaut est collective — elle désigne la source (ex : "la chaîne", "les auteurs", nom collectif défini dans `source.yaml:source.attribution`). N'attribuer individuellement que quand c'est explicitement identifiable dans le transcript (segment solo, auto-identification, rôle reconnu).

Le ton et les principes d'attribution spécifiques à une source sont définis dans `Sources/<NomSource>/CLAUDE.md`.

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

Chaque source déclare ses types actifs dans `Sources/<NomSource>/source.yaml`. C'est une **whitelist stricte** : `Scripts/new_source.py` ne scaffolde que les dossiers correspondants, et les skills `write-*` refusent d'écrire un type désactivé.

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

Les valeurs concrètes de ces axes sont déclarées dans `Sources/<NomSource>/BUILD.md`. Elles croissent **par induction** au fil des ingestions : ajouter un nouveau thème si un sujet revient dans 2+ vidéos, un nouvel enjeu si un combat revient dans 3+ vidéos avec une position constante.

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

Les principes éditoriaux spécifiques (restituer sans challenger, nuancer, contextualiser, etc.) sont définis dans `Sources/<NomSource>/CLAUDE.md` selon la nature de la source.

### Volume

Être ambitieux dans la création de fiches. Chaque personne mentionnée significativement, chaque organisation citée, chaque mécanisme analytique décrit mérite sa fiche. Il vaut mieux créer une fiche minimale (ébauche) que de laisser un lien orphelin.

---

## Workflow git

Chaque source est versionnée dans son propre dépôt GitHub (paramètre `git.repo` dans `source.yaml`). WikiPol — l'ossature — est versionné dans un dépôt distinct.

### Stratégie de branches

```
main              ← production (publication du wiki)
 └── develop      ← intégration (état courant du vault)
      ├── ingest/<slug-video>            ← ingestion unitaire (1 vidéo)
      └── ingest-batch/<slug-sujet>      ← ingestion batch (N vidéos d'un même sujet)
```

- **`main`** : état publié du wiki. Jamais de push direct.
- **`develop`** : branche d'intégration. Toutes les ingestions sont mergées ici.
- **`ingest/<slug>`** : branche éphémère pour une ingestion unitaire. Slug = titre de la vidéo en minuscules, sans accents, tirets, tronqué à ~50 chars.
- **`ingest-batch/<slug>`** : branche éphémère pour un batch thématique. Slug = nom du sujet (ex: `paduteam-2024-w47-w48`), ~40 chars max. Un seul commit et une seule PR couvrant toutes les vidéos du batch.

### En début d'ingestion

1. Se placer sur develop à jour : `git checkout develop && git pull origin develop`
2. Créer la branche : `git checkout -b ingest/<slug>` (ou `ingest-batch/<slug>`)

### En fin d'ingestion

1. Stage les fichiers modifiés/créés par nom (pas `git add -A`)
2. Commit avec message structuré :
   ```
   ingest: TITRE ABRÉGÉ DE LA VIDÉO

   Fiches créées: X (liste)
   Fiches enrichies: Y (liste)
   Corrections ortho: Z (liste si applicable)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
3. Push : `git push -u origin ingest/<slug>`
4. Merge dans develop (PR ou merge direct selon convention de la source)

---

## Chemins d'un vault source

```
Sources/<NomSource>/
├── CLAUDE.md                     ← contexte éditorial de la source
├── BUILD.md                      ← taxonomie locale
├── source.yaml                   ← config paramétrique (content_types, git, model)
├── Skills/                       ← (optionnel) skills propres à la source qui surchargent
│   └── <skill-name>/SKILL.md     ←   les skills génériques de WikiPol/Skills/
├── Sources/
│   ├── Inventaire.md             ← table des vidéos (Dataview)
│   └── Transcripts/              ← transcripts bruts (.md) — type raw
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
