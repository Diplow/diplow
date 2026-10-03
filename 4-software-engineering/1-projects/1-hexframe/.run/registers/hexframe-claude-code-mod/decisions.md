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

HEX-26, [#25](https://github.com/Diplow/diplow/pull/25). The project's language says a Leaf keeps its direction but not where an unnumbered file goes, nor whether a dot file counts. STACK.md now says an unnumbered Leaf takes the first free direction in name order, the rule folders already follow in claude-mod, and that a dot file is neither a Leaf nor Context: it keeps `.gitignore` and `.mcp.json` out of the ring, and matches the vault's own count of six files per node, which leaves dot files out.
