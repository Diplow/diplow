---
title: Skills
parent: .
owner: diplo
preview: >-
  The only place skills come from in this repo. My own skills sit here grouped
  in ship, review and meta, invoked as /<name>; external repos are vendored
  under external/ and invoked as /<vendor>:<name>. .skills/sync links them all
  into .claude/skills and switches off every skill defined outside the repo.
---
# Skills

An inner child of the root: the skills I use, and the only ones a session started in this repo sees.

## Where a skill goes

- **Mine:** anywhere in this folder's hierarchy, as `<folder>/<name>/SKILL.md`. Folders are for me; Claude Code sees one flat list, so a name is invoked as `/<name>` and must be unique across the hierarchy.
- **Someone else's:** vendored whole under `external/<vendor>/`, as a plain copy of their repo. Its skills are invoked as `/<vendor>:<name>`, so `/mattpocock:grill-me` and my own `/grill-me` both come up when I type `/grill-me`. Vendored files keep their upstream format and don't take our frontmatter.

My skills are grouped by what they act on:

| # | Folder | Skills |
|---|---|---|
| 1 | [[.skills/1-ship/CLAUDE\|Ship]] | From intent to `main`: tickets, PRs, autonomous runs |
| 2 | [[.skills/2-review/CLAUDE\|Review]] | Hold code to my software principles |
| 3 | [[.skills/3-meta/CLAUDE\|Meta]] | Skills about skills |

Three references are shared by every skill and cited by their path from the repo root: [[.skills/writing-tone\|writing-tone]] (the voice), [[.skills/model-tiers\|model-tiers]] (which model a subagent runs on) and [[.skills/conductor-workspaces\|conductor-workspaces]] (branches and worktrees).

`external/sources` lists each vendored repo and the commit it was copied at. To add one, append `<vendor> <owner/repo> -` and run `.skills/sync --pull`.

## `.skills/sync`

A `SessionStart` hook in `.claude/settings.json` runs it at the start of every session, so a skill installed outside the repo is switched off by the next session. Run it by hand to see a change in the current session. It:

1. rebuilds `.claude/skills/` with one symlink per skill (Claude Code only looks one level deep there, and follows symlinks);
2. rewrites `skillOverrides` and `enabledPlugins` in `.claude/settings.json` so that user skills (`~/.claude/skills`), claude.ai synced skills and installed plugins are off in this repo. A user skill I define here myself isn't switched off; mine takes its place.

`--pull` first re-copies every repo in `external/sources` at its latest commit.

Conductor loads its own `conductor:conductor` skill with `--plugin-dir`, which settings can't switch off. It is the one outside skill left.
