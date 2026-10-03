---
title: Top-level stack
parent: .
owner: diplo
preview: >-
  What the repo root owns. Markdown with Obsidian links and YAML frontmatter, read
  by me in Obsidian and by agents in Claude Code. The repo is a hexframe node:
  meta (.claude, .obsidian, .skills) as inner children, six domains of interest as
  children. .skills is the only source of skills, symlinked flat into
  .claude/skills. Software lives in 4-software-engineering/1-projects;
  hexframe is a pnpm monorepo.
---
# Top-level stack

What the root of the repo owns. Each child node describes its own stack in its own `CLAUDE.md`; this file covers only what applies repo-wide.

## One medium, two readers

Content is Markdown. I read it through Obsidian: the repo root is the vault. Agents read it through Claude Code: the `CLAUDE.md` chain plus the root `.claude/` config. Everything written here has to work for both.

- **Links** are Obsidian wikilinks: `[[note]]`, `[[note#heading]]`, `[[note|label]]`.
- **Frontmatter** opens every Markdown file, `CLAUDE.md` included:

  ```yaml
  ---
  title: What the parent's list calls this file
  parent: path of the node this file hangs in, from the repo root (`.` for the root)
  owner: diplo
  preview: >-
    At most 350 characters. The paragraph a reader needs to decide whether to open
    the file, written so most readers won't have to. The parent's CLAUDE.md can reuse it.
  ---
  ```

  A `SKILL.md` keeps the `name` and `description` Claude Code requires and adds these four.

- **Private files** start with `-`: a file or folder named `-something` is encrypted on GitHub and plain on my machine, in the original folder and every worktree. [transcrypt](https://github.com/elasticdog/transcrypt) does this through the patterns in `.gitattributes`. Only contents are hidden: names, paths, sizes and commit messages stay public. Name a file with `-` from its first commit; a file renamed to `-` later keeps its old plain version in the history.

  On a new clone, `transcrypt -c aes-256-cbc -p '<passphrase>'` decrypts the private files. The passphrase is in my password manager. Without it, the private files can't be recovered.

## Layout: the repo is a hexframe

The repo root is one node. A node holds:

| Slot | Budget | What goes there |
|---|---|---|
| `CLAUDE.md` | 1, outside every budget | The node's Tile: a preview and a link per child |
| Context, the inner children | 6 dot folders | Meta about the node itself: `.claude/`, `.obsidian/`, `.skills/`, `.conductor/`, `.github/` |
| Branches, the children (1 to 6) | 6 folders | The node's facets, numbered by their place on the ring: `1-name/` … `6-name/` |
| Leaves, the files | 6 | Content that belongs to the node itself, not to one facet. Dot files aren't Leaves |

These are the words every medium that shows the vault as a hexframe reads it with, set out in [[4-software-engineering/1-projects/1-hexframe/STACK#A vault as a hexframe|hexframe's STACK]]. A Leaf that needs children of its own grows into a Branch and keeps its number: `3-games.md` becomes `3-games/`.

Every Branch is a node again, with the same shape and its own `CLAUDE.md`. The limit of 6 is the point: it forces prioritization and keeps each node small enough to hold in one sitting. A node that overflows its budget is ready to be cut, not worked around.

Children sit on a ring: neighbors share an edge, and the child across the ring is a tension the node balances. Fewer than six is fine while a node is young; the missing numbers stay free for the facets still to come.

## Root-level pieces

| Piece | Role | Status |
|---|---|---|
| `CLAUDE.md` | Agent entry point: what the repo is, the six domains | exists |
| `STACK.md` | This file | exists |
| `.claude/` | Inner child: Claude Code config shared by every agent working in the repo | exists |
| `.obsidian/` | Inner child: Obsidian config that makes the repo root a vault; per-device layout (`workspace*.json`) stays out of git; `node_modules/` is excluded from the vault | exists |
| `.skills/` | Inner child: the skills I use, mine and vendored; see [[.skills/CLAUDE\|Skills]] | exists |
| `.conductor/` | Inner child: Conductor settings; the setup script installs hexframe's dependencies in each new workspace | exists |
| `.github/` | Inner child: GitHub Actions, one workflow per project, path-filtered to it so a note never triggers one | exists |
| `cubic.yaml` | cubic's review config: three custom agents on hexframe pull requests, whose briefs live in [[4-software-engineering/1-projects/1-hexframe/.cubic/CLAUDE\|hexframe's .cubic]]. cubic reads it from `main` only | exists |
| `.mcp.json` | MCP servers for this repo only; the `X-Project` header on `hodor` gives it an OAuth login separate from other projects' `hodor` | exists |
| `.gitignore` | Paths kept out of git | exists |
| `.gitattributes` | Marks `-` files and folders for encryption | exists |

The six children are the domains listed in [[CLAUDE]]. Each one is a node with its own `CLAUDE.md`, and owns whatever stack its content needs.

### Skills: a hierarchy, exposed flat

Claude Code only discovers skills sitting directly under `.claude/skills/<name>/SKILL.md`, it follows symlinks, and the folder name becomes the command, colons included (all checked on 2026-09-27). So:

- `.skills/` is the only source of skills in this repo. My own skills sit there in folders and subfolders, like any other node; external skill repos are vendored under `.skills/external/<vendor>/`.
- `.claude/skills/` holds one symlink per skill, pointing into `.skills/`: `/<name>` for mine, `/<vendor>:<name>` for vendored ones. My skill names must be unique across the hierarchy, since the flat directory is where they meet.
- `.claude/settings.json` switches off every skill defined outside the repo (user skills, claude.ai synced skills, plugins).
- `.skills/sync` rebuilds both the symlinks and the overrides; [[.skills/CLAUDE|Skills]] says when to run it.

### Software

Software lives in `4-software-engineering/1-projects/`, one project per numbered child. [[4-software-engineering/1-projects/1-hexframe/CLAUDE|hexframe]] is a pnpm monorepo whose packages are its own numbered children; its `CLAUDE.md` has the rules. The site is not started.

A domain can hold projects of its own, carrying their tooling with them. [[6-politics/1-projects/CLAUDE|Politics' projects]] hold wikipol, Obsidian vaults built from political media by Claude skills and Python scripts; it keeps its imported layout until it is cut into a hexframe.

## Workflow

The loop that steers agents is part of the stack:

- **Linear** (Hexframe team) holds intent: projects and tickets.
- **Conductor** runs agents in parallel, one git worktree per workspace.
- **Claude Code** is the agent; **skills** encode the processes I repeat.
- **GitHub** (`Diplow/diplow`) holds history. Every change lands on `main` through a pull request, notes and skills as much as code: nothing is pushed to `main` directly. Once a pull request is merged, `main` is pulled into the original folder, where Obsidian is open.
