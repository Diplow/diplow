---
title: mod
parent: 4-software-engineering/1-projects/1-hexframe/2-mod
owner: diplo
preview: >-
  @hexframe/mod, a Claude Code mod: /hexframe [folder] opens a pane that shows
  a folder as a hexframe, its tile in the middle and its six children or its
  context around it, and walks the tree from there. A Raster in the terminal,
  an SVG in the Desktop app.
---
# mod

`@hexframe/mod`, a [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview): a plugin whose hooks module draws in Claude Code itself. It shows a folder of this vault as a hexframe without the app.

## Use it

Mods need Claude Code 2.1.287 or later, and are in early access. From the repo root:

```bash
claude --plugin-dir 4-software-engineering/1-projects/1-hexframe/2-mod
```

Then `/hexframe` shows the session's folder, and `/hexframe <folder>` another one, relative to the session's. In the pane, `1` to `6` open the tile in that direction, `u` goes up, `c` switches between the Children and the Context, Tab outlines the hex whose button it lands on, `p` swaps the drawing for that hex's `CLAUDE.md`, rendered (the folder's own when no hex is outlined), and back, `r` reads the folder again, and Esc closes it.

## How it reads a folder

As [[4-software-engineering/1-projects/1-hexframe/STACK#A vault as a hexframe|STACK]] says, at depth 1. Not all of it yet. It shows the Branches and never the Leaves, so its Children are what STACK calls the Branches kind. It reads no `.hexframe/` folder: no exclusions, and a `.hexframe/` folder would show as a Context tile. It doesn't check a symlinked folder against the vault's edge. And a folder that overflows is named under the drawing instead of turning the Frame into a list.

## Scripts

| Script | Does |
|---|---|
| `check` | `claude plugin validate` (it warns that this `CLAUDE.md` is no plugin context: it is the vault's, not Claude's), then Prettier |
| `test` | `claude plugin test`: the tests in `tests/`, with no session and no network |

Both run the Claude Code pinned in `package.json`, whose install script links its native binary (allowed in `pnpm-workspace.yaml`).

## Layout

| Path | Holds |
|---|---|
| `.claude-plugin/plugin.json` | The plugin's manifest |
| `hooks/register.ts` | The hooks: the `/hexframe` command, the pane and its keys. The only file that calls `$` |
| `hooks/node.ts` | A folder read as a Frame, from its listing and its `CLAUDE.md`. Pure |
| `hooks/layout.ts` | Where the seven hexes of a Frame sit. Pure |
| `hooks/raster.ts`, `hooks/svg.ts` | The drawing, in terminal cells and in SVG. Pure |
| `tests/` | The pure functions' tests, and the pane's, with the file system stubbed |

A hooks module only imports its own files by relative path, so the mod can't share `1-app`'s hex geometry; `layout.ts` keeps its own.

When a session loads the mod, Claude Code writes the types of its build in `.claude-plugin/types/` and a `tsconfig.json`; both are ignored by git. Neither `check` nor CI can write them, so type-check by hand after a session has loaded the mod: `tsc -p .`. Relative imports end in `.js`, as that `tsconfig.json` expects; the loader finds the `.ts` file.
