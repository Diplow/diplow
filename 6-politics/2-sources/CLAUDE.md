---
title: Sources
parent: 6-politics/2-sources
owner: diplo
preview: >-
  The political media I follow, one numbered node per Source: PaduTeam and
  Boniface for now. Each holds its config, its editorial context and its
  Chronicle, where wikipol's pipeline files one Digest per Publication by date.
  Six Sources at most here; past six, they get grouped.
---
# Sources

The media whose output I want to argue from, each one a **Source** in the sense of [[6-politics/1-projects/1-wikipol/CONTEXT|wikipol's glossary]]: a YouTube channel today, a newspaper or a site later. [[6-politics/1-projects/1-wikipol/CLAUDE|wikipol]] is the pipeline that fills them; this node is what it fills.

| # | Source | What it is |
|---|---|---|
| 1 | [[6-politics/2-sources/1-paduteam/CLAUDE\|PaduTeam]] | A Marxist YouTube channel, the media arm of La Brèche |
| 2 | [[6-politics/2-sources/2-boniface/CLAUDE\|Boniface]] | Pascal Boniface's geopolitics channel; he founded IRIS |

## A Source node

| Slot | What goes there |
|---|---|
| `CLAUDE.md` | The Source's Tile and its editorial context: who speaks, the tone, the traps a reader falls into. Whoever writes a Digest reads it first |
| `source.yaml` | Its config, read through wikipol's `Scripts/source_config.py`: the channel, the model its pipeline runs, and `legacy.vault`, the frozen vault it came from, if any |
| `1-chronicle/` | Its Chronicle: the Digests filed by date in a tree of Periods that split by count ([[6-politics/1-projects/1-wikipol/docs/adr/0001-chronicle-splits-by-count\|ADR 0001]]) |
| `2-` to `6-` | Free, for a structure that emerges from the Digests rather than one decided up front |
| `.skills/` | The Source's own skills, each overriding wikipol's skill of the same name, grouped by six |

## Six at most

This node takes six Sources. The seventh means regrouping first, by kind of media or by country, whichever the seven make obvious, and `Scripts/new_source.py` refuses to create it until then.

The Obsidian vaults these Sources started as are frozen in `wikipol/Legacy/`: read as extra input, never written.
