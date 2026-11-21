---
name: new-source
description: "Add a YouTube channel to wikipol as a Source. Given a channel URL or @handle, it looks at the channel, settles the name, slug, hosts and where the Chronicle starts, scaffolds the node under 6-politics/2-sources with wikipol's new_source.py, stores five Raws spread over the channel's history, drafts the editorial CLAUDE.md that write-digest reads from the channel's page and those Raws, proves the draft on one Digest, lists the Source in the Sources node, then commits and pushes on the working branch. Use when someone says \"add this channel to wikipol\", \"new source\", \"I want to follow this YouTube channel\" or \"/politics:wikipol:new-source <channel URL>\". It files nothing in the Chronicle: fetching the channel's history and digesting it is ingest-source."
argument-hint: "<channel URL or @handle> [display name] [--since YYYY-MM-DD]"
title: new-source
parent: .skills/6-politics/1-wikipol/new-source
owner: diplo
preview: >-
  Turns a YouTube channel into a wikipol Source: looks at the channel, picks its
  name, slug, hosts and starting date, scaffolds the node, stores five Raws,
  drafts the editorial context write-digest reads and proves it on one Digest.
  Commits and pushes. ingest-source then takes the channel's history.
---

# new-source. A YouTube channel becomes a Source

A Source is a node under `6-politics/2-sources/`: a `source.yaml`, an editorial `CLAUDE.md`, an empty `1-chronicle/`. [[6-politics/2-sources/CLAUDE|The Sources node]] says what each slot holds, and `6-politics/1-projects/1-wikipol/CLAUDE.md` what the pipeline does with them. `Scripts/new_source.py` writes the node from templates. What it can't write is the editorial context, and a Source digested on the bare template gets Digests that attribute a guest's or a character's words to the channel. Most of this skill is that file.

Several channels in one request: run the steps below for each in turn, one commit each.

The scripts named `scripts/…` are this skill's; those named `ingest-source/scripts/…` belong to the sibling skill, in the folder next to this one.

## 1. Look at the channel

```bash
scripts/look.sh <channel URL or @handle>
```

It prints the channel's name, handle and About text, how many videos its Videos tab lists and how long they run, the twelve newest and twelve oldest titles, the Sources the repo holds and the node the new one takes. It needs `uv`, `git`, `claude`, the bucket's settings and the network. Exit 2 says why it stopped: one of those is missing, the channel can't be listed, it is a Source already, or the Sources node holds six, in which case regrouping them comes first and is the user's decision. Relay the message and stop.

## 2. Settle the config

| Field | Rule |
|---|---|
| `name` | the user's display name if they gave one, else the channel's name as YouTube writes it (`Heu?reka`) |
| `slug` | the name in lowercase ASCII letters and digits, nothing else (`heureka`, `lereveilleur`). It is the Raws' prefix in the bucket and the node's folder: the one field that can't change later |
| `attribution` | how a French sentence names who speaks: the person for a channel one person leads (`Pascal Boniface`), the channel for a collective (`la PaduTeam`, `Blast`) |
| `hosts` | who leads every video, when it is always the same people. A name goes in only when two of these give it: the About text, a Raw, a web search. Otherwise none: a wrong host is a mention the checker waves through on every Digest |
| `since` | the user's `--since` if given. Else nothing, the whole channel, when the Videos tab lists 500 videos or fewer; above that, the date three years before today, as Blast and Osons Causer were cut |

Print the five values with the reason for each, then go on. All but the slug are one line of `source.yaml` to change later.

## 3. Scaffold the node

From `6-politics/1-projects/1-wikipol/`:

```bash
python3 Scripts/new_source.py --name "<name>" --slug "<slug>" \
  --youtube-url "<channel_url printed by look.sh>" --attribution "<attribution>" \
  [--hosts "<Name, Other Name>"] [--since <YYYY-MM-DD>]
```

It creates `6-politics/2-sources/<n>-<slug>/` at the first free number and refuses a slug already taken.

The node is committed in step 7, so the branch must be a working branch: on the default branch, `git switch -c wikipol/new-source-<slug>` now. A Conductor workspace is already on its own (`.skills/conductor-workspaces.md`).

## 4. Store five Raws and have them read

```bash
scripts/sample.sh <slug>     # about two minutes; 600000 ms timeout, it may wait behind another fetch
```

It stores five Raws spread evenly over the channel's listing, from its newest video to its oldest, and copies them to a temporary folder, printing each one's path, date, length and title. Spread, because a channel's five newest videos are often one series: Heu?reka's were four episodes of a show it co-hosts, and none of the scripted dialogues that make up most of the channel. It waits its turn behind any other fetch on the machine, and takes the next video over when one has no French captions. A video published before the Source's `since` is copied out to be read and not stored, so the bucket holds nothing the Chronicle will not.

Exit 2 means it has no Raw to show: a setting is missing, YouTube is refusing the machine, or the channel has no French captions. Any other exit that is not 0 is a crash. Either way, relay its last line, stop there and report. Without a Raw there is nothing to ground the editorial context on, and a Source digested on the bare template is what this skill exists to prevent. The node stays, uncommitted, for the next try.

Then delegate the reading to one **work-tier** subagent (the session's model: what it reports decides how every Digest of the Source is written, and five Raws are up to 40,000 words that have no place in this session). Give it the output of `look.sh`, the five lines `sample.sh` printed, and the six questions of `references/editorial.md`, "What the sweep returns". It answers in 40 lines.

Print its recap for the user, then go on.

## 5. Write the editorial context

Write `6-politics/2-sources/<n>-<slug>/CLAUDE.md` as `references/editorial.md` lays it out: the sections, the rules of "Pour le Digest", the line that marks it a draft. Use only what the sweep grounded. If the sweep named a host that step 2 left out, or contradicts the attribution, correct `source.yaml` now.

## 6. Prove it on one Digest

```bash
ingest-source/scripts/digest.sh <slug> <youtube_id of a sampled Raw>   # 600000 ms timeout
```

Pick the sampled Raw of the format the channel makes most. When the sweep found a format where the voices change (a co-hosted show, an interview), prove a Raw of that format too: two Digests at most, and they can be written at the same time.

Read the staged Digest against the three checks of `references/editorial.md`, "The proof", and follow its rule for a miss: fix the file, delete the staged Digest, write it again, two rounds at most. A Digest that passes stays staged for `ingest-source` to file.

`digest.sh` exits 1 when the checker refused the Digest twice. That is about that Raw, not the editorial file: try another sampled Raw. Exit 2 means it could not run (`claude`, the bucket): run it once more, and if it fails again go to step 7 with the proof missing and say so in the report, quoting its last line.

## 7. List the Source, verify, commit

1. In `6-politics/2-sources/CLAUDE.md`, add the Source's row to the table (number, link, one clause on what it is) and its name to the `preview`.
2. Verify, from `6-politics/1-projects/1-wikipol/Scripts/`:

   ```bash
   uv run pytest -q tests/test_config.py     # every Source's source.yaml loads, with a pinned model
   ../../../../.skills/6-politics/1-wikipol/ingest-source/scripts/preflight.sh <slug>
   ```

   The preflight line must show the channel, the starting date you chose and `0 Digests in its Chronicle`.
3. Commit the node, the Sources table and nothing else, as `feat(wikipol): <name> becomes a Source`, then `ingest-source/scripts/push.sh`. On macOS a commit in this repo needs `nproc` on the `PATH` for transcrypt's hook; `ingest-source/scripts/file.sh` shows the two-line shim.

## 8. Report

Short, in the voice of `.skills/writing-tone.md`:

- the node's path and the five values of step 2, with the ones you were not sure of;
- what the channel holds: videos listed, hours, the starting date;
- the rules of "Pour le Digest" in one line each, and any check of step 6 that still misses;
- the next command: `/politics:wikipol:ingest-source <slug>`, with what it will take on (the number of videos, about one Digest every three minutes).

The editorial file is a draft until the user has read it. Say so, and that a change to it after the ingestion only reaches the Digests written from then on.
