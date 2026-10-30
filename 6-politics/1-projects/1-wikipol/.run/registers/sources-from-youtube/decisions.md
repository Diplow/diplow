---
title: decisions, Sources from YouTube
parent: 6-politics/1-projects/1-wikipol/.run/registers/sources-from-youtube
owner: diplo
preview: >-
  The choices the autonomous run made while building wikipol's pipeline, where
  a ticket left room: how PaduTeam's eleven override skills regrouped by six,
  how a Source's config finds its frozen vault, what became of the legacy
  scripts and of new_source.py, how the moved editorial files were touched,
  and what the frozen glossary still says that I should fix.
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

WIK-1. `run_ingest.py`, `generate_chronological.py`, `batch_transcripts.py` and the `ingest-*`, `gather-context` and `write-*` skills all write into a vault, and the vaults are frozen. I fixed their paths (`--source` now takes the Source node, vault files go through `vault_root`) and put a line at the top of each script and in wikipol's `CLAUDE.md` saying they are the legacy pipeline, kept for reference and not to be run on a frozen vault. WIK-3 takes discovery and caption parsing out of `batch_transcripts.py`. Those three scripts also stop, through `source_config.require_vault`, on a Source with no `legacy.vault`, so the legacy pipeline can never write transcripts or trackers into a Source node.

`new_source.py` would have recreated `wikipol/Sources/<Name>/`, a vault in the place the glossary just retired. It now scaffolds a Source node at the first free number of `6-politics/2-sources/`: `source.yaml`, the editorial `CLAUDE.md` from the template (now with the four-field frontmatter) and an empty `1-chronicle/CLAUDE.md` from a new `Templates/chronicle_CLAUDE.md.tmpl`. It refuses a seventh Source until the six are regrouped. `Templates/source_BUILD.md.tmpl`, the vault's local taxonomy, had no reader left and is gone.

### DEC-4 The moved editorial files keep their text; only their frontmatter, a lead note and literal paths changed

WIK-1. The two editorial `CLAUDE.md` files and PaduTeam's eleven skills were written for their vault. I left their bodies as written and changed three kinds of thing: the frontmatter (`parent` set to the new node, the editorial previews rewritten for a Source, the four fields added to every `SKILL.md`); a short lead note on each editorial `CLAUDE.md` saying the text below describes the frozen vault and that its relative paths read there; and the literal paths that pointed at the old place (`--source Sources/Paduteam`, Boniface's `../../CLAUDE.md`, `Sources/Paduteam/` in the four advanced skills, the rclone commands). The vault's notes under `Legacy/` are untouched; `Legacy/CLAUDE.md` is new and says they are frozen.

### DEC-5 For Ulysse: the glossary still places the legacy vaults at `wikipol/Sources/`

WIK-1. `CONTEXT.md`'s **Source** entry says "the legacy vaults under `wikipol/Sources/` are not Sources". They are now under `wikipol/Legacy/`. The run doesn't edit `CONTEXT.md`, so the path is yours to update. The run config's comments name `wikipol/Sources/` too, for the rule that freezes the legacy notes there.
