---
title: Obsidian
parent: .
owner: diplo
preview: >-
  How I read and write this repo. Obsidian is a Markdown reader that feels great
  for taking notes, with many ways to browse: wikilinks, backlinks, the graph,
  search, properties. The repo root is the vault; this folder is its shared
  config, and per-device layout stays out of git.
---
# Obsidian

An inner child of the root: the config that makes the repo root an [Obsidian](https://obsidian.md) vault.

## What it is for

Obsidian is mostly a Markdown reader. The files stay plain Markdown on disk, so agents read the same files I do. On top of that, it makes taking notes feel good, and it has many ways to move around:

- **Links:** `[[wikilinks]]` resolve as I type, and each note lists its backlinks and outgoing links.
- **Graph:** the whole vault, or one note's neighborhood, as a graph.
- **Search and switcher:** full-text search, and jumping to any note by name.
- **Properties:** the frontmatter (`title`, `parent`, `owner`, `preview`) shows as editable fields, and Bases and Dataview query it.
- **Page preview:** hovering a link shows the note without leaving the one I'm in.

## How it is used here

- The vault is the repo root, opened in the original folder. Conductor worktrees aren't vaults: a change reaches Obsidian once its pull request is merged and `main` is pulled there. The one exception is a worktree where the hexframe plugin is being developed, opened as a second vault so its build reloads live ([[4-software-engineering/1-projects/1-hexframe/3-obsidian-plugin/CLAUDE|obsidian-plugin]]).
- `node_modules/` is excluded from the vault (`app.json`).
- Per-device layout (`workspace*.json`) stays out of git.

## Plugins

| Plugin | Does |
|---|---|
| Dataview | Queries notes and their frontmatter, as tables and lists |
| Excalidraw | Drawings inside the vault |
| Hexframe | Mine, built from [[4-software-engineering/1-projects/1-hexframe/3-obsidian-plugin/CLAUDE\|obsidian-plugin]]. It will show a folder of the vault as a hexframe, and loads doing nothing for now. Desktop only, its build committed in `plugins/hexframe/` |
| Git | Commits and pulls from inside Obsidian |
| Hidden folders access | Indexes the dot folders (`.claude/`, `.skills/`, this one) so they show in the file tree and in searches |
| Iconize | Icons on files and folders |
