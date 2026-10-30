---
title: Projects
parent: 6-politics/1-projects
owner: diplo
preview: >-
  What I build in politics, one project per numbered child. For now, wikipol:
  the pipeline that turns political YouTube channels into the Sources under
  6-politics/2-sources, built by Claude skills and Python scripts. Its old
  per-channel vaults are frozen in its Legacy/ folder.
---
# Projects

What I build in politics. Each project is a numbered child and owns its own stack.

| # | Project | What it is |
|---|---|---|
| 1 | [[6-politics/1-projects/1-wikipol/CLAUDE\|wikipol]] | The pipeline that fills [[6-politics/2-sources/CLAUDE\|the Sources]] from political media; its old vaults frozen in `Legacy/`; written in French |

## wikipol

Imported from [Diplow/wikipol](https://github.com/Diplow/wikipol) on 2026-10-01. Its two vaults were git submodules there and came in as plain folders: the Paduteam vault from `Diplow/paduteam-wiki` (branch `develop`), the Boniface vault from wikipol's own history, since `Diplow/boniface-wiki` was empty. Those repos are no longer the source of truth. Since WIK-1 both vaults are frozen in `Legacy/`, and each channel is a Source node under [[6-politics/2-sources/CLAUDE|6-politics/2-sources]], holding its `source.yaml`, editorial `CLAUDE.md` and Chronicle.

wikipol keeps the layout it came with, which is not yet a hexframe: unnumbered folders (`Scripts/`, `Skills/`, `Legacy/`, `Templates/`), and a Paduteam vault with more than six folders. Its content notes carry their own frontmatter, not this repo's four fields.

Its skills stay in `Skills/` and in each Source's `.skills/`, and are not exposed through the root `.skills/`: wikipol's `CLAUDE.md` tells the agent to read them by path, a Source's skill overriding the generic one of the same name. Its git workflow follows this repo: a working branch, a pull request into `main`, never a push to `main`.
