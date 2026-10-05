---
title: decisions, hexframe app Import & export
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-app-import-export
owner: diplo
preview: >-
  The choices the autonomous run made while building hexframe's Import &
  export, where a ticket left room: how a Leaf slot is stored and named, what
  a read answers now that a Child is a Branch or a Leaf, and where Mapping's
  Leaf rules and tests went once its folder was full.
---
# Decisions

### DEC-1 A Leaf slot is stored as 7 to 12 and named `{ leaf: n }`

HEX-53, [#61](https://github.com/Diplow/diplow/pull/61). The ticket asked for a Leaf slot space beside the Branch and Context slots and left its shape open. The `tile` table keeps one `direction` column, a Leaf in Direction n stored as n + 6, so the unique slot index covers the new slots unchanged, the direction check gains them (migration `leaf-slots`) and every existing row reads as a Branch; only `tile.ts` knows the offset (`rowDirection`, `leafOf`). Everywhere else, Mapping's `Slot`, the API's schema and the MCP tools, a Leaf slot is `{ leaf: n }`, so an agent and the client name a Leaf by the Directions 1 to 6 the language gives it, never by 7 to 12.

### DEC-2 A read answers `branches` and `leaves` where it answered `children`, and Help says nothing of Leaves yet

HEX-53, [#61](https://github.com/Diplow/diplow/pull/61). `SystemTile`, `ReadTile` and `openTile`'s answer carry `branches` and `leaves`, each by Direction: Child stays the word for either kind, so no field is named after one kind alone, and a Leaf is read as a Tile with nothing below it. The canvas keeps its own `children`, filled from `branches`, and draws no Leaf until M4. Help's notes still teach six Children at most, which is what the canvas shows; they learn Branch and Leaf once the canvas draws them.

### DEC-3 Mapping's Leaf rules and their tests live in `domains/mapping/leaves/`

HEX-53, [#61](https://github.com/Diplow/diplow/pull/61). `domains/mapping/` already held its six files, and `mapping.test.ts` sat at the 600-line cap once `children` became `branches` and `leaves`. The new `leaves/` holds `leaves.ts`, the two checks a change runs (`notLeaf` and `holdsNothingIfLeaf`), and `leaves.test.ts`, those checks on rows made by hand, then Mapping's operations on Leaves over PGlite. Like `help/`, it has no `CLAUDE.md` of its own: Mapping's folder table says what it holds.
