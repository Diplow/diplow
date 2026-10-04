---
title: decisions, hexframe Obsidian plugin
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-obsidian-plugin
owner: diplo
preview: >-
  The choices the "hexframe Obsidian plugin" run made where a ticket left room,
  one entry each, for the tickets that come after and for me.
---
# Decisions

### DEC-1 `build` writes into `dist/` until HEX-30

HEX-28, [#36](https://github.com/Diplow/diplow/pull/36). CI already builds the plugin once `3-obsidian-plugin/package.json` exists, and fails when `.obsidian/plugins/hexframe/` then differs from what is committed. Committing the build is HEX-30's work, so the scaffold's `build` writes into the package's own `dist/`, ignored by git, and leaves that folder alone: CI stays green with nothing committed there. HEX-30 points `build` at `.obsidian/plugins/hexframe/` and drops `dist/`. `dev` already writes into a vault's plugin folder, the worktree's own unless `HEXFRAME_VAULT` names another vault.

### DEC-2 The `obsidian` typings are 1.13.1, not 1.14.x

HEX-28, [#36](https://github.com/Diplow/diplow/pull/36). The ticket asked for typings pinned to the current app, which it took for 1.14.x. The app installed here runs 1.13.7, and the newest `obsidian` package on npm is 1.13.1, so the typings are pinned to exactly that, and `minAppVersion` follows them: the plugin types no API the app lacks.

### DEC-3 `styles.css` is a plain file copied beside `main.js`, and `build` owns its folder

HEX-30. The ticket asks `build` for `main.js`, `manifest.json` and `styles.css`, and the plugin has no styles yet. `styles.css` sits beside `manifest.json` in the package, holding one comment, and every build copies it as it is, the way it copies the manifest. A ticket that brings styles writes them there, or switches to a CSS file esbuild bundles, as long as the output keeps the name `styles.css`. DEC-1 is done: `build` writes into the repo's `.obsidian/plugins/hexframe/` and `dist/` is gone. Since `dev` writes into that same folder by default, a production build also removes the `.hotreload` a dev build leaves there, so after `pnpm build` the folder holds exactly what is committed, and CI's build-and-compare step fails on a committed `.hotreload`.

### DEC-4 The view state at depth 1: a center and the outer ring's kind, decoded by hand

HEX-33. The ticket asks for the file's JSON to hold the center and the expansions, and HEX-35 owns the double expansion. So `expansions` holds only `outer` for now, the kind of the ring around the center (`children`, `branches`, `leaves`), defaulting to Children, or Branches when the folder offers no Children ring; HEX-35 adds `inner` and the Branches' own beside it. The decoder is a hand-written function in `view-state.ts` rather than Effect Schema: the plugin bundles no runtime dependency, and two fields don't justify one. A malformed field falls back on its own, so one typo doesn't reset the center.

### DEC-5 The shape is written in erasable syntax, and the bundle lowers template literals

HEX-33. The plugin's `tsc` type-checks the shape it imports, under `erasableSyntaxOnly`, which refuses the parameter properties of `exclusions.ts`'s `Cursor`: they became plain fields, with no change in behavior. And the shape joins lines with template literals holding `\n`, which esbuild's minifier writes as raw line breaks, so the production build no longer fit on the two lines `bundle.test.ts` takes as the mark of a minified build: the bundle now lowers template literals to string concatenation (`supported: { 'template-literal': false }`), which keeps each `\n` an escape.

### DEC-6 `diplow.hexframe` is empty, and the root STACK doesn't list it yet

HEX-33. The vault's entry is an empty `diplow.hexframe` at the root: empty means the defaults, the root's Branches. It is a Leaf of the root, beside `STACK.md` and `cubic.yaml`. The root `STACK.md`'s table of root-level pieces should name it, but the run may not edit that file: a line for it there is left to me.

### DEC-7 The plugin reads a Frame with its own copy of claude-mod's read, for now

HEX-33, [#39](https://github.com/Diplow/diplow/pull/39). `vault/frame.ts`'s `readFrame` follows the steps of claude-mod's `loadFrame` (exclusions first, then the sort, then one Tile per seated member, an overflowing ring left as names), over a `Disk` port instead of `$.fs`. It adds one rule claude-mod lacks: every read must lie within the vault's real path, since Obsidian's index lists a symlinked folder as a folder. Moving one `readFrame` over a port into the shape would stretch the shape's rule that a medium does the file system calls, and it would change claude-mod's pane, so this ticket keeps the copy and leaves that call to me. cubic raised it in every review round of #39.


### DEC-8 The clicks the ticket left open, and what a click may open

HEX-34. The ticket's click rules leave four cases open, settled here so they read the same everywhere:

- **The center goes up and shows the note there.** Going up is centering on the folder holding the center, so it shows that folder's note, as centering on a Branch does: the pane follows the view. At the vault root there is nowhere to go up to, and the click shows the root's own note.
- **A Leaf that isn't Markdown goes to the default app, shift held or not.** The paired pane is for notes, and Obsidian opens most files that aren't Markdown in no view of its own.
- **The paired pane is split off the view's own leaf** with `createLeafBySplit(this.leaf, 'vertical')`, not `getLeaf('split', 'vertical')`, which splits whichever leaf is active: the two match when the click comes from the view, and the first can't split another pane by mistake. The note opens with `active: false`, so the view keeps the focus for the next click.
- **What a click opens is held to the vault, as what the view reads is.** A note or a file whose real path leaves the vault, through a symlinked folder, opens nothing, and a folder whose real path does is not centered on; a notice says why. Obsidian types no "Open in default app", so the view calls the app's own `openWithDefaultApp`, checked to exist, and says so in a notice when it is missing. A Leaf handed to the system runs whatever the system does with it, a script included: that is what the ticket asks, and it stays a deliberate click on a file of the vault.
