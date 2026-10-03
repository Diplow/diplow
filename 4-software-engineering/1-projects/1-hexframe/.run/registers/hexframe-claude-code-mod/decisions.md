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
