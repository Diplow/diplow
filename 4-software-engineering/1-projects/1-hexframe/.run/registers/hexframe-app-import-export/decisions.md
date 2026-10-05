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

### DEC-1 A Leaf slot is stored as 7 to 12 and named `{ leaf: n }`; a read answers `branches` and `leaves`

HEX-53. The ticket asked for a Leaf slot space beside the Branch and Context slots, and left its shape open. The `tile` table keeps one `direction` column: a Leaf in Direction n is stored as n + 6, so 7 to 12 sit beside the Branches' 1 to 6 and the Context's −1 to −6. The unique slot index covers the new slots unchanged, the direction check gains them (migration `leaf-slots`), and every existing row reads as a Branch. Only `tile.ts` knows the offset (`rowDirection`, `leafOf`). Outside the table, a Leaf slot is `{ leaf: n }` with n a Direction, in Mapping's `Slot`, the API's schema and the MCP tools, so an agent and the client name a Leaf by the same Directions 1 to 6 the language gives it, never by 7 to 12. A Tile read whole (`SystemTile`) or to a depth (`ReadTile`), and `openTile`'s answer, carry `branches` and `leaves`, each by Direction, where they carried `children`: Child stays the word for either kind, so no field is named after one kind alone. A Leaf is read as a Tile with nothing below it (`LeafTile`, `ReadLeaf`). The canvas keeps its own `children`, which it fills from `branches` and leaves the Leaves out of until M4.

### DEC-2 Mapping's Leaf rules and their tests live in `domains/mapping/leaves/`

HEX-53. `domains/mapping/` already held its six files, and `mapping.test.ts` sat at the 600-line cap once `children` became `branches` and `leaves`. The new folder `leaves/` holds `leaves.ts`, the two checks a change runs (`notLeaf`, nothing under a Leaf; `fitsIn`, nothing that holds anything into a Leaf slot), and `leaves.test.ts`, Leaves beside Branches over PGlite. `mapping.ts` calls the checks from `freeSlot`, which every create, move and Reference passes through, and from `moveTile` and `swapTiles`.
