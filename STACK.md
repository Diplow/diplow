# Top-level stack

What the root of the repo owns. Each subproject describes its own stack in its own `CLAUDE.md`; this file covers only what applies repo-wide.

## One medium, two readers

Content is Markdown. I read it through Obsidian: the repo root is the vault. Agents read it through Claude Code: the `CLAUDE.md` chain plus the root `.claude/` config. Everything written here has to work for both.

## Root-level pieces

| Piece | Role | Status |
|---|---|---|
| `CLAUDE.md` | Agent entry point: what the repo is, pointers down to subprojects | exists |
| `STACK.md` | This file | exists |
| `.claude/` | Claude Code config shared by every agent working in the repo | exists |
| `.mcp.json` | MCP servers for this repo only; the `X-Project` header on `hodor` gives it an OAuth login separate from other projects' `hodor` | exists |
| `.obsidian/` | Obsidian config; makes the repo root a vault | planned |
| Monorepo tooling | Workspace setup for the applications I implement | probable, undecided |

## Subprojects

Each one owns its stack and documents it in its own `CLAUDE.md`.

| Subproject | Purpose | Kind |
|---|---|---|
| skills | Define the skills I use | agent tooling |
| hexframe | The app that defines and organizes contents | application |
| website | My personal website | application |
| docs | Document what I do, and my conclusions from those experiences | content |

## Workflow

The loop that steers agents is part of the stack:

- **Linear** (Hexframe team) holds intent: projects and tickets.
- **Conductor** runs agents in parallel, one git worktree per workspace.
- **Claude Code** is the agent; **skills** encode the processes I repeat.
- **GitHub** (`Diplow/diplow`) holds history; changes land on `main` through pull requests.

## Open questions

- Links: Obsidian wikilinks (`[[note]]`) or standard Markdown links (render on GitHub)?
- How do the skills subproject's skills reach `.claude/skills/`: symlink, plugin, or copy?
- Which monorepo tooling, and do the non-application subprojects (skills, docs) sit inside it?
- Directory layout for subprojects (e.g. `hexframe/` at the root, or grouped under `apps/`, `content/`).
