---
title: decisions, hexframe Claude Code mod
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-claude-code-mod
owner: diplo
preview: >-
  The choices the "hexframe Claude Code mod" run made where a ticket left room,
  one entry each, for the tickets that come after and for me.
---
# Decisions

### DEC-1 Unnumbered Leaves and dot files

HEX-26, [#25](https://github.com/Diplow/diplow/pull/25). The project's language says a Leaf keeps its direction but not where an unnumbered file goes, nor whether a dot file counts. STACK.md now says an unnumbered Leaf takes the first free direction in name order, the rule claude-mod already follows for folders, and that a dot file is neither a Leaf nor Context. That second one is a choice made here, not a rule the vault states: the root STACK.md counts `.gitignore` and `.mcp.json` among its pieces, but showing them as tiles would put tooling on the ring the six-file budget keeps for content.

### DEC-2 The shared shape lives in claude-mod

HEX-29. The ticket wanted the shape in `1-hexframe/.shape/`, but a Claude Code mod loads nothing outside its own folder: `claude plugin validate` and `claude plugin test` both refuse `../../.shape/spike.js` as outside the plugin, and a symlink inside `2-claude-mod/`, to the folder or to a single file, reads as "no such file". So the ticket's fallback held: the shape is `2-claude-mod/hooks/shape/`, with its own `CLAUDE.md`, and the Obsidian plugin imports it by relative path. Its tests sit beside it on `claude-code/testing` rather than Vitest, run by claude-mod's `test`, and claude-mod's `check` greps that no file of it imports from outside the folder.

### DEC-3 Where a Leaf goes in the Children ring, and what opening one shows

HEX-31. The ticket says the Branches take their directions first and a Leaf its own number when free, else the first free slot. Three readings were left open. A Branch keeps the direction it has among the Branches, unnumbered ones included, so `c` never moves a folder: a numbered Leaf whose number an unnumbered Branch took moves, without a clash. The Leaves are seated in two passes, every free number first and then the rest in name order, so a displaced `1-a.md` can't take the number `2-b.md` claims. And a clash is a Leaf numbered like the Branch that holds its direction, the one case where the two names say the same direction; claude-mod names it on a dim line under the drawing. Opening a Leaf shows its file in the preview, a Markdown one rendered and any other in a fenced block, since the pane has no other place to show a file.

### DEC-4 What overflows, what an overflowing ring carries, and the exclusions file's one key

HEX-32. The ticket marks a Frame with more than six candidates as overflowing; the shape also calls a name whose number another took an overflow, and a rename clears it, so a ring overflows as soon as one candidate finds no direction, six or fewer as they may be. The Children ring keeps DEC-3's exception: there a Leaf whose number another holds takes a free direction, so only two Branches on one number turn it into a list, where the same two Leaves in a Leaves ring do. An overflowing ring carries its candidates' names, not their Tiles: a list reads no file, however large the folder, and shows the names an exclusion matches, while the layout places no member for it until HEX-38 draws the list inside a hex. `exclusions.yaml` has one key, `exclude:`, globs know `*` and `?` and a trailing `/` for folders only, and a file that can't be parsed leaves nothing out, with a red line in claude-mod, rather than hiding the folder.
