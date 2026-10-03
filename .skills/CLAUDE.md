---
title: Skills
parent: .
owner: diplo
preview: >-
  The only place skills come from in this repo. My own skills sit here by domain,
  invoked by their path (/softeng:ship:do-ticket, /games:riftbound:play);
  external repos are vendored under external/ and invoked as /<vendor>:<name>.
  .skills/sync links them all into .claude/skills and switches off every skill
  defined outside the repo.
---
# Skills

An inner child of the root: the skills I use, and the only ones a session started in this repo sees.

## Where a skill goes

- **Mine:** under the domain folder it serves, as `<domain>/<group>/<name>/SKILL.md`. Claude Code sees one flat list, so `sync` names each skill by its path with the `N-` of every folder dropped: `4-softeng/1-ship/do-ticket` is invoked as `/softeng:ship:do-ticket`. The path is the name, so it is unique by construction.
- **A skill's subagents:** in an `agents/` folder inside the skill, as `<name>.md`. `sync` links each one into `.claude/agents/`, where Claude Code finds subagents, so an agent name must be unique across the hierarchy. Its `preview` stays on one quoted line: Claude Code silently drops a subagent whose frontmatter holds a folded `preview: >-` block (checked on 2026-10-03).
- **Someone else's:** vendored whole under `external/<vendor>/`, as a plain copy of their repo. Its skills are invoked as `/<vendor>:<name>`, such as `/mattpocock:grill-me`. Vendored files keep their upstream format and don't take our frontmatter.

My skills are grouped by the domain they serve, numbered like the domains on the root ring:

| # | Folder | Prefix | Skills |
|---|---|---|---|
| 3 | [[.skills/3-games/CLAUDE\|Games]] | `games:` | Playing and building decks: Riftbound for now |
| 4 | [[.skills/4-softeng/CLAUDE\|Software Engineering]] | `softeng:` | Shipping, reviewing, and skills about skills |

Three references are shared by every skill and cited by their path from the repo root: [[.skills/writing-tone\|writing-tone]] (the voice), [[.skills/model-tiers\|model-tiers]] (which model a subagent runs on) and [[.skills/conductor-workspaces\|conductor-workspaces]] (branches and worktrees).

`external/sources` lists each vendored repo and the commit it was copied at. To add one, append `<vendor> <owner/repo> -` and run `.skills/sync --pull`.

## `.skills/sync`

A `SessionStart` hook in `.claude/settings.json` runs it at the start of every session, so a skill installed outside the repo is switched off by the next session. Run it by hand to see a change in the current session. It:

1. rebuilds `.claude/skills/` with one symlink per skill (Claude Code only looks one level deep there, and follows symlinks), and `.claude/agents/` with one symlink per skill subagent;
2. rewrites `skillOverrides` and `enabledPlugins` in `.claude/settings.json` so that user skills (`~/.claude/skills`), claude.ai synced skills and installed plugins are off in this repo.

`--pull` first re-copies every repo in `external/sources` at its latest commit.

Conductor loads its own `conductor:conductor` skill with `--plugin-dir`, which settings can't switch off. It is the one outside skill left.
