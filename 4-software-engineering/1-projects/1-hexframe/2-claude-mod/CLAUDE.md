---
title: claude-mod
parent: 4-software-engineering/1-projects/1-hexframe/2-claude-mod
owner: diplo
preview: >-
  @hexframe/claude-mod, a Claude Code mod: /hexframe [folder] opens a pane that
  shows a folder as a hexframe, its tile in the middle and its six children or
  its context around it, and walks the tree from there. A Raster in the
  terminal, an SVG in the Desktop app.
---
# claude-mod

`@hexframe/claude-mod`, a [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview): a plugin whose hooks module draws in Claude Code itself. It shows a folder of this vault as a hexframe without the app.

## Use it

Mods need Claude Code 2.1.287 or later, and are in early access. From the repo root:

```bash
claude --plugin-dir 4-software-engineering/1-projects/1-hexframe/2-claude-mod
```

Then `/hexframe` shows the session's folder, and `/hexframe <folder>` another one, relative to the session's. In the pane:

| Key | Does |
|---|---|
| `1` to `6` | Opens the hex in that direction: a Branch or a Context tile walks into its folder, a Leaf shows its file in place of the drawing |
| `u` | Goes up to the parent folder |
| `c` | Cycles the Frame kinds the folder offers: Children then Context, or, past six Branches and Leaves, Branches, Leaves, then Context |
| Tab | Outlines the hex whose button it lands on |
| `p` | Swaps the drawing for the outlined hex's file, and back: a folder's `CLAUDE.md` (the shown folder's own when no hex is outlined) or a Leaf, rendered when it is Markdown and shown as it is otherwise |
| `r` | Reads the folder again |
| Esc | Closes the pane |

Leaves take their own fill, warm where Branches are slate. In a Children frame, a Leaf that shares its number with the Branch in that direction, as `3-games.md` beside `3-games/`, is named on a dim line under the drawing.

## How it reads a folder

Through the [[4-software-engineering/1-projects/1-hexframe/2-claude-mod/hooks/shape/CLAUDE|shape]], the one definition every medium reads a vault by, at the depth [[4-software-engineering/1-projects/1-hexframe/STACK#A vault as a hexframe|STACK]] gives claude-mod: 1. It shows the four Frame kinds the shape offers. What the shape doesn't read yet, claude-mod doesn't show: a `.hexframe/` folder shows as a Context tile. A ring that overflows is named under the drawing instead of turning the Frame into a list.

## Scripts

| Script | Does |
|---|---|
| `check` | `claude plugin validate` (it warns that this `CLAUDE.md` is no plugin context: it is the vault's, not Claude's), then Prettier, then a grep that fails when a file of `hooks/shape/` imports from outside it |
| `test` | `claude plugin test`: every `*.test.ts`, the shape's beside it and the rest in `tests/`, with no session and no network |

Both run the Claude Code pinned in `package.json`, whose install script links its native binary (allowed in `pnpm-workspace.yaml`).

## Layout

| Path | Holds |
|---|---|
| `.claude-plugin/plugin.json` | The plugin's manifest |
| `hooks/register.ts` | The hooks: the `/hexframe` command, the pane and its keys. The only file that calls `$` |
| `hooks/shape/` | The [[4-software-engineering/1-projects/1-hexframe/2-claude-mod/hooks/shape/CLAUDE\|shape]]: a folder read as a Frame, and where the hexes of a view sit at a given depth. Pure, and shared with every other medium |
| `hooks/raster.ts`, `hooks/svg.ts` | The drawing, in terminal cells and in SVG. Pure |
| `hooks/markdown.ts` | A file as the preview's Markdown element draws it: a Markdown one without its frontmatter, any other in a fenced block. Pure |
| `tests/` | The drawing's tests, and the pane's, with the file system stubbed; the shape's sit beside it |

A hooks module only imports files under its own folder, by relative path: an import that leaves the folder, even through a symlink, is refused. That is why the shape lives here and the other media import it from claude-mod, not the other way.

When a session loads the mod, Claude Code writes the types of its build in `.claude-plugin/types/` and a `tsconfig.json`; both are ignored by git. Neither `check` nor CI can write them, so type-check by hand after a session has loaded the mod: `tsc -p .`. Relative imports end in `.js`, as that `tsconfig.json` expects; the loader finds the `.ts` file.
