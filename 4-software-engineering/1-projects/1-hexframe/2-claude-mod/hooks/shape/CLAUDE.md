---
title: shape
parent: 4-software-engineering/1-projects/1-hexframe/2-claude-mod/hooks/shape
owner: diplo
preview: >-
  How a vault reads as a hexframe, written once for every medium: the rules
  that turn a folder listing into Frames, and the layout that places a view's
  hexes, at every scale it opens. Pure TypeScript, kept inside claude-mod because a mod can import
  nothing outside its own folder.
---
# shape

How a folder of this vault reads as a hexframe, written once for every medium that shows one: claude-mod in Claude Code, the Obsidian plugin in Obsidian, the app one day. If each medium read a folder its own way, the same vault would show as two hexframes. How a medium then looks at what this reads (the Frame kind, the depth, the expansions, a list for an overflowing Frame) is view state, each medium's own: [[4-software-engineering/1-projects/1-hexframe/STACK#A vault as a hexframe|STACK]]. The layout takes the Frame kind as input, and the hexes a view opens, and a medium decides both. claude-mod opens none and gets one generation; the Obsidian plugin, the first medium to draw deeper, opens the center twice and its Branches once, as [[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-claude-code-mod/decisions#DEC-6 The layout draws one generation until a medium draws deeper|DEC-6]] planned: [[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-obsidian-plugin/decisions#DEC-9 The shape lays out opened hexes, and the plugin keeps which ones|DEC-9]].

The app reads by the shape what an import hands it, a zipped or picked folder, through one module of Mapping (`1-app/src/domains/mapping/files/import/shape.ts`), and Help's folder through the same reader. It draws nothing by it yet: `1-app/src/front/ui/hex/` keeps its own geometry, on the same lattice, until the canvas lays itself out with `layout.ts`.

## Why it lives inside claude-mod

A Claude Code mod loads only the files under its own folder: an import that leaves it, directly or through a symlink, is refused by `claude plugin validate` and by the loader alike. So the shape sits in claude-mod's `hooks/`, and every other medium imports it from here by relative path. The decision is [[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-claude-code-mod/decisions#DEC-2 The shared shape lives in claude-mod|DEC-2]].

## Rules

- **Pure.** No `$`, no Node, no DOM: a medium does the file system calls and hands the listing and the body here.
- **Nothing imported from outside this folder**, a package included. claude-mod's `check` fails on an import that leaves it.
- **Erasable syntax only**: no parameter properties, enums or namespaces. The Obsidian plugin type-checks the shape under `erasableSyntaxOnly`, and its `check` fails on them.
- **Tests beside each file**, as `*.test.ts` on `claude-code/testing`. claude-mod's `test` runs them and its `check` formats them: the shape has no deployable, so it is no package. A change here changes every medium.

| File | Holds |
|---|---|
| `node.ts` | A folder read as a Frame: its Tile from its `CLAUDE.md`, and from its listing, once the exclusions have left names out, the rings of the Frame kinds it offers (Children, or Branches and Leaves, then Context), each seated by direction, a Children ring with its clashes, or overflowing with the list of its candidates; which file a Tile's body is read from, and which files a medium reads at all; titles from names, a file's lines and its frontmatter split from its body, the path arithmetic |
| `exclusions.ts` | What a folder leaves out: its `.hexframe/exclusions.yaml` parsed, with no YAML library, into names and globs, matched in time linear in the name and the glob; the names every folder leaves out; what a folder leaves out when its file is missing, unread or broken (nothing, with a warning); and the exclusion that names a candidate, as a list shows it |
| `layout.ts` | Where each hex of a view sits: its Tile and the ring of the Frame kind it shows, and inside each hex the view opens (the Tile's own, a member's) a Frame a third of its size, short of a margin; a collapsed center alone, filling the view. Each hex says what it holds (the center, a Branch, a Leaf or a Context tile), its size, its generation and whether it is opened, so a renderer fills it. A hex opened into a ring that overflows holds that ring as its `list`, with nothing placed inside it, and a view whose own ring overflows is its Tile alone, holding that ring as a list that fills the view: a medium shows both as lists |

## How a vault reads

It borrows Mapping's Tile, Context and Frame from STACK, and adds words for what a System doesn't have: files beside folders. A folder holds up to six Branches and six Leaves, and a Frame still draws at most six hexes around its Tile.

The root `STACK.md` lays out the same slots from the repo's side: its children are the Branches, its files the Leaves (dot files aside), its inner children the Context.

What a folder is:

- **Tile**: a folder's own is the `title` and `preview` of its `CLAUDE.md`, or of its `-CLAUDE.md` when it keeps a private one. Without either, a title made from the folder's name. A frontmatter opens with a `---` first line and closes with the next one; a file whose block never closes has no frontmatter, and is all body, in the Tile and in a preview alike.
- **Branch** and **Leaf**: a child folder and a file. A Leaf grows into a Branch when it needs children of its own, and keeps its direction: `3-games.md` becomes `3-games/`. Branches and Leaves count their directions apart: `<n>-<slug>` sits in direction n, and an unnumbered name takes the first free direction in name order. When two names claim one number, the later in name order overflows. A folder's `CLAUDE.md` and `-CLAUDE.md` are its Tile, never Leaves, and a dot file is neither a Leaf nor Context: [[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-claude-code-mod/decisions#DEC-1 Unnumbered Leaves and dot files|DEC-1]].
- **Context**: the dot folders. `.<n>-<slug>/` sits in direction n, as hexframe exports a System, then the other dot folders (`.claude/`, `.skills/`) take the free slots in name order.
- **`.hexframe/` folder**: a folder's settings. Its `exclusions.yaml` lists the names and globs that folder leaves out, for that folder only, under its one key, `exclude:`, as a block list (`- dist/`) or a flow list (`[dist/, "*.log"]`). A glob's `*` stands for any run of characters and its `?` for one, and a trailing `/` keeps it to folders. `.hexframe/` itself is always left out, as are `.git` and `node_modules`, in every Frame kind, so `.hexframe/` never takes a Context slot. A medium reads a folder's `exclusions.yaml` only when its real path is the folder's own plus `.hexframe/exclusions.yaml`: unlike the rest of the vault, it is never followed through a symlink, even one that stays inside the vault, since it would then speak for another folder. A file it doesn't read, or can't parse, leaves nothing out, and the medium says why: [[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-claude-code-mod/decisions#DEC-4 What overflows, what an overflowing ring carries, and the exclusions file's one key|DEC-4]].
- **The vault's edge**: a medium reads nothing outside the vault. It follows a symlink only when the symlink's real path lies under the vault root's real path, compared folder by folder rather than as a string prefix; any other symlink is left out like an excluded name.
- **What a medium reads**: a regular file of 1 MB or less whose real path lies under its folder's, compared folder by folder, so a symlink never leads a read out of its folder, nor into a device. A file past the limit, out of its folder, or that fails to read, gives a Tile made from its name, Branch, Context tile or Leaf alike, and a medium that would show it says why it doesn't. `unreadable` in `node.ts` decides, so every medium leaves the same files unread: [[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-claude-code-mod/decisions#DEC-5 Which files a medium reads|DEC-5]].
- **Overflow**: a candidate that finds no direction, because its ring already has six or because its number is taken. A ring with one is **overflowing**: it holds no members by direction, only the list of its candidates' names, the Branches before the Leaves, which a medium shows as a list. A list reads no file, so a folder of hundreds stays cheap, and it shows the names an exclusion would match: [[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-claude-code-mod/decisions#DEC-4 What overflows, what an overflowing ring carries, and the exclusions file's one key|DEC-4]]. A medium reads the Tile of each seated name, a **Member**; an overflowing ring's names stay **Slots**.
- **The Children ring**, offered when a folder's Branches and Leaves are six or fewer in all, in place of a Branches and a Leaves ring. The Branches sit where they sit among the Branches. Each numbered Leaf then takes its number's direction when it is free, and the Leaves left over take the free directions in name order. A Leaf whose number is the Branch's in that direction, as `3-games.md` beside `3-games/`, is a **clash**, which a medium shows as a subtle warning. Only a seated Children ring carries clashes: [[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-claude-code-mod/decisions#DEC-3 Where a Leaf goes in the Children ring, and what opening one shows|DEC-3]].
- **A Leaf's Tile**: a Markdown Leaf's from its own frontmatter, else a title made from its name, `.md` dropped; a Leaf that isn't Markdown keeps its name, `package.json`.

Not all of it is code yet. claude-mod checks no symlink against the vault's edge itself: in its listing a symlink is neither a folder nor a file, so it shows as nothing, and the files it reads by name (a body file, `exclusions.yaml`) are held to their own folder, which is stricter. Obsidian's index lists a symlinked folder as a folder, so the Obsidian plugin holds its center and every file it reads to the vault's real path too, with `liesWithin`.
