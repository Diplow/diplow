---
title: decisions, Sources from YouTube
parent: 6-politics/1-projects/1-wikipol/.run/registers/sources-from-youtube
owner: diplo
preview: >-
  The choices the autonomous run made while building wikipol's pipeline, where
  a ticket left room: how PaduTeam's eleven override skills regrouped by six,
  how a Source's config finds its frozen vault, what became of the legacy
  scripts and of new_source.py, how the moved editorial files were touched,
  what the frozen glossary still says that I should fix, and how the Raws
  reached the bucket: which ids and dates were found, which 12 stayed on Drive.
---
# Decisions

### DEC-1 PaduTeam's override skills sit in a `.skills/` Context folder, in three groups

WIK-1. PaduTeam's vault had eleven override skills in `Skills/`, and the Source node must keep the rule of 6. An unnumbered `Skills/` folder would have taken a Branch slot, and the project keeps the Source's five slots after `1-chronicle/` free for a structure that emerges. So the skills became the node's Context, `.skills/`, the way the repo root keeps its own skills, regrouped by wikipol's `BUILD.md` classes:

- `1-ingest/`: `gather-context`, `ingest-batch`, `ingest-video`
- `2-write-basic/`: `write-concept`, `write-entity`, `write-evenement`, `write-video`
- `3-write-advanced/`: `write-conjoncture`, `write-enjeu`, `write-methode`, `write-possible`

The folder is still the skill's name, so the override rule only gains a wildcard: `6-politics/2-sources/<n>-<slug>/.skills/*/<name>/SKILL.md` wins over `wikipol/Skills/<name>/SKILL.md`. The root `.skills/sync` scans the root `.skills/` only, so none of these reach Claude Code's skill list.

### DEC-2 `source.yaml` points at its frozen vault with `legacy.vault`, and `source_config` resolves vault paths from it

WIK-1. Moving `source.yaml` out of the vault broke `Scripts/source_config.py`, which took the folder holding `source.yaml` for the vault root. Each `source.yaml` now carries `legacy.vault`, the vault's path relative to the file (`../../1-projects/1-wikipol/Legacy/Paduteam`), and `SourceConfig` gains `vault_root`: the inventory, the `_CHRONOLOGIQUE.md` tracker and the transcripts resolve from it, and `source_root` stays the Source node. A Source with no vault gets `vault_root = source_root`. This also gives WIK-4 the way from a Source to its legacy notes, which `write-digest` reads as extra input.

### DEC-3 The legacy scripts are kept for reference; `new_source.py` scaffolds a Source node

WIK-1. `run_ingest.py`, `generate_chronological.py`, `batch_transcripts.py` and the `ingest-*`, `gather-context` and `write-*` skills all write into a vault, and the vaults are frozen. I fixed their paths (`--source` now takes the Source node, vault files go through `vault_root`) and put a line at the top of each script and in wikipol's `CLAUDE.md` saying they are the legacy pipeline, kept for reference and not to be run on a frozen vault. WIK-3 takes discovery and caption parsing out of `batch_transcripts.py`. Those three scripts also stop, through `source_config.require_writable_vault`, before writing anything: on a Source with no `legacy.vault`, and on a vault under `wikipol/Legacy/`. Today that is every Source, so the freeze is enforced, not only written down: running them again means moving a vault out of `Legacy/`, a decision for Ulysse.

`new_source.py` would have recreated `wikipol/Sources/<Name>/`, a vault in the place the glossary just retired. It now scaffolds a Source node at the first free number of `6-politics/2-sources/`: `source.yaml`, the editorial `CLAUDE.md` from the template (now with the four-field frontmatter) and an empty `1-chronicle/CLAUDE.md` from a new `Templates/chronicle_CLAUDE.md.tmpl`. It refuses a seventh Source until the six are regrouped. `Templates/source_BUILD.md.tmpl`, the vault's local taxonomy, had no reader left and is gone.

### DEC-4 The moved editorial files keep their text; only their frontmatter, a lead note and literal paths changed

WIK-1. The two editorial `CLAUDE.md` files and PaduTeam's eleven skills were written for their vault. I left their bodies as written and changed three kinds of thing: the frontmatter (`parent` set to the new node, the editorial previews rewritten for a Source, the four fields added to every `SKILL.md`); a short lead note on each editorial `CLAUDE.md` saying the text below describes the frozen vault and that its relative paths read there; and the literal paths that pointed at the old place (`--source Sources/Paduteam`, Boniface's `../../CLAUDE.md`, `Sources/Paduteam/` in the four advanced skills, the rclone commands). The vault's notes under `Legacy/` are untouched; `Legacy/CLAUDE.md` is new and says they are frozen.

### DEC-5 For Ulysse: the glossary still places the legacy vaults at `wikipol/Sources/`

WIK-1. `CONTEXT.md`'s **Source** entry says "the legacy vaults under `wikipol/Sources/` are not Sources". They are now under `wikipol/Legacy/`. The run doesn't edit `CONTEXT.md`, so the path is yours to update. The run config's comments name `wikipol/Sources/` too, for the rule that freezes the legacy notes there.

### DEC-6 `copy-from-drive` finds a Raw's id and date beyond its frontmatter; 609 of the 621 Raws are in the bucket

WIK-2. The ticket asked for the `youtube_id` from the transcript's frontmatter, the others listed. On Drive that left 38 of 621 without one: Boniface's five transcripts carry no frontmatter at all, and none of the 621 carries its publication date. So `copy-from-drive` looks, in order, at the frontmatter's `youtube_id`, its `url` (`watch?v=`), then, read-only, the frozen vault: a `Videos/` note's `youtube_id` and `date` for the transcript it links under `## Transcript`, and a row of the vault's inventory table (Boniface's), whose URL, date and transcript link sit on one line. A transcript two entries tie to different ids gets none.

The copy of 2026-10-31: PaduTeam 604 of 616, Boniface 5 of 5, every object byte for byte its Drive file (a second run found all 609 already there, compared by content). Left on Drive, listed in the pull request: 11 PaduTeam transcripts with an English title (YouTube's translated title) and no id anywhere offline, and one duplicate, `THAÏS les VSS l'ont rendue NAZIE !.md`, a second transcript of `4MLEHjkr7Rs` in another format; the first by name went in. For Ulysse: the 11 ids can only come from YouTube, by hand or through the Fetcher once WIK-3 lands. 150 PaduTeam Raws have no `published` in their metadata; the index (WIK-7) searches by date, so the Fetcher's metadata will have to fill it.

`~/.config/wikipol/.env` held neither `WIKIPOL_S3_BUCKET` nor `WIKIPOL_S3_ENDPOINT` at the time; the copy ran with them set in its process environment (`wikipol-raws`, `https://s3.fr-par.scw.cloud`). For Ulysse: add both lines to the file, or every later command needs them on its command line.

### DEC-7 ruff covers the new package, not the legacy scripts beside it

WIK-2. The gate runs `ruff check .` and `ruff format --check .` from `Scripts/`, where the six legacy scripts of DEC-3 also sit. Linting them would mean rewriting code kept for reference and never run, so `pyproject.toml` lists them in `extend-exclude`, by name: a new file in `Scripts/` is linted, and moving a legacy script into the package means removing its line. No rule is lowered for the code the run writes.

### DEC-8 A Raw's metadata carries its Drive title, percent-encoded; four Raws don't use the `M:SS` blocks

WIK-2. S3 metadata travels as HTTP headers, ASCII only, so the store percent-encodes `title` and decodes it on `get`. The title is the frontmatter's `titre` when there is one, else the Drive file's name, which is the video's title with `:`, `?` and `|` dropped; the true title comes with the Fetcher's metadata.

Most Raws are 30-second blocks, a `M:SS` line then text. Four are not, and WIK-4 and WIK-7 must not assume it: `X0tXWZsjENQ`, `4MLEHjkr7Rs` and `mCek51AyK50` use `**[MM:SS](https://www.youtube.com/watch?v=ID&t=N)**` blocks under a title and URL header, and `wsiChBGb6T0` (BORIS VALLAUD N'A PAS DIT SON DERNIER MOT !) has no timestamp at all, so no Extract of it can carry one.
