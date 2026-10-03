---
title: shape
parent: 4-software-engineering/1-projects/1-hexframe/2-claude-mod/hooks/shape
owner: diplo
preview: >-
  How a vault reads as a hexframe, written once for every medium: the rules
  that turn a folder listing into Frames, and the layout that places a view's
  hexes at a given depth. Pure TypeScript, kept inside claude-mod because a mod
  can import nothing outside its own folder.
---
# shape

How a folder of this vault reads as a hexframe, written once for every medium that shows one: claude-mod in Claude Code, the Obsidian plugin in Obsidian, the app one day. If each medium read a folder its own way, the same vault would show as two hexframes. How a medium then looks at what this reads (the Frame kind, the expansions, a list for an overflowing Frame) is view state, each medium's own: [[4-software-engineering/1-projects/1-hexframe/STACK#A vault as a hexframe|STACK]]. The layout takes that state as input, and a medium decides its values.

The app is no medium of the shape yet: it reads no vault, and `1-app/src/ui/hex/` keeps its own geometry, the same lattice and the same third per generation. The two merge when the app reads a vault.

## Why it lives inside claude-mod

A Claude Code mod loads only the files under its own folder: an import that leaves it, directly or through a symlink, is refused by `claude plugin validate` and by the loader alike. So the shape sits in claude-mod's `hooks/`, and every other medium imports it from here by relative path. The decision is [[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-claude-code-mod/decisions|DEC-2]].

## Rules

- **Pure.** No `$`, no Node, no DOM: a medium does the file system calls and hands the listing and the body here.
- **Nothing imported from outside this folder**, a package included. claude-mod's `check` fails on an import that leaves it.
- **Tests beside each file**, as `*.test.ts` on `claude-code/testing`. claude-mod's `test` runs them and its `check` formats them: the shape has no deployable, so it is no package. A change here changes every medium.

| File | Holds |
|---|---|
| `node.ts` | A folder read as a Frame: its Tile from its `CLAUDE.md`, and from its listing, once the exclusions have left names out, the rings of the Frame kinds it offers (Children, or Branches and Leaves, then Context), each seated by direction with, for Children, its clashes, or overflowing with the list of its candidates; which file a Tile's body is read from, titles from names, the frontmatter, the path arithmetic |
| `exclusions.ts` | What a folder leaves out: its `.hexframe/exclusions.yaml` parsed, with no YAML library, into names and globs, and the names every folder leaves out |
| `layout.ts` | Where each hex of a view sits, `depth` generations deep, for the Frame kind the view shows. Depth 1 is one Frame, seven hexes; deeper, an expanded member shows its own Frame inside its hex, at a third of its radius, where its ring touches that hex's sides. Each member's hex says what it holds (a Branch, a Leaf or a Context tile), so a renderer fills it. A ring that overflows places no member: a medium shows it as a list |

## How a vault reads

It borrows Mapping's Tile, Context and Frame from STACK, and adds words for what a System doesn't have: files beside folders. A folder holds up to six Branches and six Leaves, and a Frame still draws at most six hexes around its Tile.

The root `STACK.md` lays out the same slots from the repo's side: its children are the Branches, its files the Leaves (dot files aside), its inner children the Context.

What a folder is:

- **Tile**: a folder's own is the `title` and `preview` of its `CLAUDE.md`, or of its `-CLAUDE.md` when it keeps a private one. Without either, a title made from the folder's name.
- **Branch** and **Leaf**: a child folder and a file. A Leaf grows into a Branch when it needs children of its own, and keeps its direction: `3-games.md` becomes `3-games/`. Branches and Leaves count their directions apart: `<n>-<slug>` sits in direction n, and an unnumbered name takes the first free direction in name order. When two names claim one number, the later in name order overflows. A folder's `CLAUDE.md` and `-CLAUDE.md` are its Tile, never Leaves, and a dot file is neither a Leaf nor Context.
- **Context**: the dot folders. `.<n>-<slug>/` sits in direction n, as hexframe exports a System, then the other dot folders (`.claude/`, `.skills/`) take the free slots in name order.
- **`.hexframe/` folder**: a folder's settings. Its `exclusions.yaml` lists the names and globs that folder leaves out, for that folder only, under its one key, `exclude:`, as a block list (`- dist/`) or a flow list (`[dist/, "*.log"]`). A glob's `*` stands for any run of characters and its `?` for one, and a trailing `/` keeps it to folders. `.hexframe/` itself is always left out, as are `.git` and `node_modules`, in every Frame kind, so `.hexframe/` never takes a Context slot.
- **The vault's edge**: a medium reads nothing outside the vault. It follows a symlink only when the symlink's real path lies under the vault root's real path, compared folder by folder rather than as a string prefix; any other symlink is left out like an excluded name.
- **Overflow**: a candidate that finds no direction, because its ring already has six or because its number is taken. A ring with one is **overflowing**: it holds no members by direction, only the list of its candidates' names, the Branches before the Leaves, which a medium shows as a list. A list reads no file, so a folder of hundreds stays cheap, and it shows the names an exclusion would match.
- **The Children ring**, offered when a folder's Branches and Leaves are six or fewer in all, in place of a Branches and a Leaves ring. The Branches sit where they sit among the Branches. Each numbered Leaf then takes its number's direction when it is free, and the Leaves left over take the free directions in name order. A Leaf whose number is the Branch's in that direction, as `3-games.md` beside `3-games/`, is a **clash**, which a medium shows as a subtle warning.
- **A Leaf's Tile**: a Markdown Leaf's from its own frontmatter, else a title made from its name, `.md` dropped; a Leaf that isn't Markdown keeps its name, `package.json`.

Not all of it is code yet. Nothing checks a symlink against the vault's edge: a symlink is neither a folder nor a file in a listing, so it shows as nothing.
