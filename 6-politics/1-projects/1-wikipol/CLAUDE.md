---
title: WikiPol
parent: 6-politics/1-projects/1-wikipol
owner: diplo
preview: >-
  The shared frame that turns a media Source (a YouTube channel today) into
  Tiles: Claude skills, Python scripts, templates and conventions. Each Source
  is a node under 6-politics/2-sources; the old per-channel vaults are frozen in
  Legacy/. Says how to work on a Source and where its skills live.
---
# WikiPol — Instructions méta

## Objectif

WikiPol est l'ossature générique qui permet de construire un graphe de connaissances Obsidian à partir d'une source média (une chaîne YouTube, demain potentiellement un podcast ou un corpus d'articles).

Une **Source** (voir `CONTEXT.md`) est un nœud de `6-politics/2-sources/`, numéroté : `1-paduteam/`, `2-boniface/`. Chaque Source :
- définit son propre contexte éditorial dans son `CLAUDE.md` (ton, principes, pièges de lecture)
- déclare ses paramètres techniques dans son `source.yaml` (URL chaîne, slug, modèle, et `legacy.vault`, son vault figé quand elle en a un)
- range ses Digests par date dans sa Chronicle, `1-chronicle/`
- peut surcharger des skills génériques dans son `.skills/`

Les skills Claude (`Skills/`), les scripts Python (`Scripts/`) et les conventions universelles (`BUILD.md`) sont partagés entre toutes les Sources.

## Les vaults legacy, figés

Avant WIK-1, chaque chaîne était un vault Obsidian dans `Sources/<NomSource>/`. Ces vaults sont figés dans `Legacy/` (`Legacy/Paduteam/`, le vault Graphiked, et `Legacy/Boniface/`) : lus en entrée, jamais écrits, jamais migrés. Leur taxonomie locale (`Legacy/<NomSource>/BUILD.md`), leurs fiches et leur tracker `_CHRONOLOGIQUE.md` y restent.

Les skills d'ingestion (`ingest-*`, `gather-context`, `write-*` hors `write-digest`) et les scripts `run_ingest.py`, `generate_chronological.py` et `batch_transcripts.py` écrivent dans un vault : c'est le pipeline legacy, gardé pour référence. Ne plus le lancer sur un vault figé.

## Comment travailler sur une Source

Lorsque l'utilisateur demande de travailler sur une Source ou de répondre à une question en l'utilisant :

1. **Identifier la Source active**. L'utilisateur la nomme explicitement, ou la working directory est son nœud `6-politics/2-sources/<n>-<slug>/`. Si ambiguë, demander.
2. **Charger le contexte de la Source**. Lire son `CLAUDE.md` : c'est ce fichier qui dicte le ton, les principes éditoriaux, les pièges, la grille analytique. Il complète et surcharge ce fichier-ci.
3. **Lire la config**. Son `source.yaml` contient les paramètres techniques (URL chaîne, nom affiché, slug, modèle). Les scripts et skills s'y réfèrent via le helper `Scripts/source_config.py`, qui résout aussi les chemins de son vault legacy (`vault_root`).
4. **Appliquer les conventions**. `BUILD.md` (ce dossier) pour les invariants universels, et `Legacy/<NomSource>/BUILD.md` pour la taxonomie de son vault figé.

## Raws : dans le bucket Scaleway, hors git

Les Raws (voir `CONTEXT.md` : les transcripts tels qu'ils ont été récupérés) vivent dans le bucket Scaleway Object Storage `wikipol-raws` (région `fr-par`, versionné), un objet par Publication : `<slug-de-la-source>/<youtube_id>.md`, ses octets inchangés. Les métadonnées de l'objet gardent ce que la clé perd : le titre d'origine (`title`, encodé en pourcent, car S3 n'admet que l'ASCII dans ses en-têtes) la date de publication quand on la connaît (`published`, au format ISO) et, pour un Raw récupéré par le Fetcher, la durée en secondes (`duration`). Le bucket est leur seul foyer (ADR 0003) : on y ajoute, on n'y remplace ni n'y efface rien.

Le paquet uv de `Scripts/` les lit et les écrit à travers `wikipol.raw_store`. Ses réglages viennent de `~/.config/wikipol/.env`, hors du repo (`WIKIPOL_ENV` désigne un autre fichier), et l'environnement du processus passe devant : `WIKIPOL_S3_BUCKET`, `WIKIPOL_S3_ENDPOINT` (`https://s3.fr-par.scw.cloud`), `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`, et `WIKIPOL_S3_REGION`, `fr-par` par défaut. Depuis `Scripts/` :

```bash
uv sync
uv run pytest                                 # sur des fakes : ni Scaleway, ni Drive, ni réseau
uv run wikipol copy-from-drive --dry-run      # ce que la copie depuis Drive ferait, sans rien écrire
uv run wikipol fetch --source paduteam --dry-run   # les vidéos de la chaîne sans Raw, des plus récentes aux plus anciennes
uv run wikipol fetch --source paduteam --limit 3   # récupère les Raws des 3 plus récentes qui en manquent
```

`wikipol fetch` liste la chaîne de la Source (`youtube.channel_url` de son `source.yaml`), garde les vidéos dont le bucket n'a pas le Raw, et les récupère des plus récentes aux plus anciennes : un frontmatter avec `youtube_id`, puis les sous-titres français par blocs de 30 s (`m:ss`), comme les Raws venus de Drive. Il attend 8 s entre deux vidéos et s'arrête après 3 échecs de suite ; `--limit N` borne les vidéos essayées, échecs compris. Le Fetcher par défaut est yt-dlp, lancé depuis le Mac, car YouTube bloque les IP de datacenter ; `--fetcher transcript-api` (ou `WIKIPOL_FETCHER=transcript-api`) passe par l'API de Supadata, qui demande `WIKIPOL_TRANSCRIPT_API_KEY`.

Jusqu'à WIK-2, les transcripts vivaient sur Google Drive, sous `diplow:WikiPol/Sources/<NomSource>/Sources/Transcripts/` (remote rclone `diplow`). `wikipol copy-from-drive` les a copiés dans le bucket le 2026-10-31 : 609 sur 621. Les 12 autres (11 sans `youtube_id` retrouvable, un doublon) sont listés dans la pull request de WIK-2. La commande prend l'identifiant dans le frontmatter du transcript, sinon dans les fiches `Videos/` et l'inventaire du vault figé ; relancée, elle ne copie que ce qui manque, et signale sans le remplacer un Raw du bucket qui diffère de Drive. Drive n'est plus qu'une archive : on n'y pousse plus rien.

## Répartition des responsabilités

| Niveau | Fichier | Contient |
|--------|---------|----------|
| WikiPol | `CLAUDE.md` (ce fichier) | Instructions méta : comment WikiPol fonctionne |
| WikiPol | `BUILD.md` | Conventions universelles : nommage, wikilinks, frontmatter, git |
| WikiPol | `CONTEXT.md` | Le glossaire : Source, Publication, Raw, Extract, Digest, Chronicle, Period |
| WikiPol | `docs/adr/` | Les décisions difficiles à défaire, une par fichier |
| WikiPol | `Skills/` | Skills d'ingestion et d'écriture génériques, agnostiques à la source |
| WikiPol | `Scripts/` | Le paquet uv `wikipol` du pipeline (`src/`, `tests/`), et les scripts Python legacy (ingestion, bootstrap), qui lisent `source.yaml` |
| WikiPol | `Legacy/` | Les vaults d'avant, figés : taxonomie locale (`BUILD.md`), fiches (`Videos/`, `Individus/`, `Concepts/`…), tracker |
| Source | `CLAUDE.md` | Contexte éditorial spécifique : qui produit, ton, pièges |
| Source | `source.yaml` | Paramètres techniques, `content_types` activés (whitelist stricte), `legacy.vault` |
| Source | `1-chronicle/` | La Chronicle : les Digests rangés par date, en Periods |
| Source | `.skills/` (optionnel) | Skills propres à la source qui surchargent les skills génériques par même nom, regroupées par six |

## Découverte des skills

Quand une skill est invoquée pendant un travail sur une source, regarder dans cet ordre :

1. **`6-politics/2-sources/<n>-<slug>/.skills/*/<skill-name>/SKILL.md`** — skill propre à la source, rangée dans un groupe (`1-ingest/`, `2-write-basic/`…) pour tenir la règle des six. Si elle existe, **elle l'emporte** sur la version générique (même nom = override).
2. **`Skills/<skill-name>/SKILL.md`** à la racine de WikiPol — skill générique, valable pour toutes les sources.

Les overrides de PaduTeam (`1-paduteam/.skills/`) portent les noms des skills du pipeline legacy et écrivent, comme elles, dans le vault figé : la règle les trouve, mais ni elles ni les génériques du même nom ne se lancent plus. `write-digest` n'a pas d'override.

Le cas typique de skill source-spécifique : un format de fiche qui s'écarte trop du modèle générique pour être paramétrable (ex : un `write-enjeu` au format « loadout militant » plutôt que narratif). Tant que la signature de la skill (entrées, sortie, prérequis) reste la même, l'override est transparent pour les orchestrateurs (`ingest-video`, `ingest-batch`).

Avant de créer une skill source-spécifique, vérifier que le besoin n'est pas paramétrable côté générique — un override coûte cher en maintenance.

## Activation des types de fiches

Chaque source déclare ses `content_types` activés dans son `source.yaml` (whitelist stricte). Une skill `write-*` invoquée pour un type désactivé doit s'interrompre et signaler à l'appelant. Avant d'écrire, charger la config via `Scripts/source_config.py` et vérifier `cfg.content_type_enabled("Enjeux")` (ou le type concerné).

Voir `BUILD.md` pour la classification raw/basic/advanced et la spec frontmatter de chaque type.

## Créer une nouvelle source

```bash
python Scripts/new_source.py --name "NomSource" --slug "nomsource" \
    --youtube-url "https://www.youtube.com/@Chaine/videos"
```

Le script crée le nœud de la Source au premier numéro libre de `6-politics/2-sources/` (`source.yaml`, `CLAUDE.md` éditorial à remplir, `1-chronicle/` vide) et refuse une septième Source tant qu'on n'a pas regroupé.

## Principes d'auto-amélioration

Comme dans chaque source, chaque ingestion est une occasion de raffiner le système. Si un transcript révèle un besoin générique (un type de skill manquant, une convention à étendre), mettre à jour `BUILD.md` ou les skills au niveau WikiPol. Si c'est spécifique à la source, mettre à jour son `CLAUDE.md`.

Rien n'est figé.
