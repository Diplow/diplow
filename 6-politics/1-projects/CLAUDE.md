---
title: Projects
parent: 6-politics/1-projects
owner: diplo
preview: >-
  What I build in politics, one project per numbered child. For now, wikipol:
  Obsidian knowledge graphs of political YouTube channels, one vault per source
  (PaduTeam, Boniface), built by Claude skills and Python scripts.
---
# Projects

What I build in politics. Each project is a numbered child and owns its own stack.

| # | Project | What it is |
|---|---|---|
| 1 | [[6-politics/1-projects/1-wikipol/CLAUDE\|wikipol]] | Obsidian knowledge graphs built from political media sources, one vault per source under `Sources/`; written in French |

## wikipol

Imported from [Diplow/wikipol](https://github.com/Diplow/wikipol) on 2026-10-01. Its two sources were git submodules there and are plain folders here: `Sources/Paduteam` comes from `Diplow/paduteam-wiki` (branch `develop`), `Sources/Boniface` from wikipol's own history, since `Diplow/boniface-wiki` was empty. Those repos are no longer the source of truth.

wikipol keeps the layout it came with, which is not yet a hexframe: unnumbered folders (`Scripts/`, `Skills/`, `Sources/`, `Templates/`), and a Paduteam vault with more than six folders. Its content notes carry their own frontmatter, not this repo's four fields.

Its skills stay in `Skills/` and `Sources/<source>/Skills/` and are not exposed through `.skills/`: wikipol's `CLAUDE.md` tells the agent to read them by path, a source's skill overriding the generic one of the same name. Its git workflow follows this repo: a working branch, a pull request into `main`, never a push to `main`.
