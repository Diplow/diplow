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

### DEC-4 What a Tile keeps is checked by its type: a write takes only a decoded Name, Tile config and Frontmatter

HEX-54. The ticket asks that a bad Name be refused "when stored", `NameInvalid`, and leaves open which operation stores one, since the import (HEX-57, HEX-58) is not built yet. `createTile` takes the three, optional, beside the content, but typed as the branded types of three Effect Schemas in `domains/mapping/kept/kept.ts` (`Name`, `TileConfig`, `Frontmatter`): only a decode makes one, so nothing unchecked reaches the tiles repository, and `named` and `configured` give `NameInvalid` on the field at fault (`name` or `config`). Had `createTile` taken raw strings and refused them itself, its error type would have gained `NameInvalid`, and the MCP's `create_tile`, whose refusals are typed by its program's errors, would have had to teach agents a refusal no input of theirs can meet: neither the server function nor the MCP tool accepts the three. The Frontmatter schema's failure stays a Schema error, for the import to fold into `ImportRefused` among its faults; the ticket names no error for it. `editTile`, `moveTile` and `swapTiles` never touch the three: none of them passes one to the repository's `update`, which, speaking rows, would write any column it is given (cubic's local review on #62 asked that the rule stay Mapping's rather than the repository's type). The bounds live in these schemas, as DEC-8 of `hexframe-v0-mapping` keeps them in the API's: the migration (`tile-kept-from-files`) adds three nullable columns, `name` text, `config` and `frontmatter` jsonb, with no check of their own, since a byte count over jsonb would need raw SQL in the schema. `kept/` is a new folder because `domains/mapping/` held its six files.

### DEC-5 A Tile config is inherited part by part, and a folder pattern fills in at least one placeholder

HEX-54. "Inherited by everything below, until a Tile below sets its own" leaves open whether a config that sets only the file name keeps the folder pattern from above. It does: the naming in force at a Tile is each part its own config sets, else the nearest Tile above's, else the defaults (`CLAUDE.md`, `<n>-<slug>`), so a `.hexframe/config.yaml` lists only what it changes. The naming in force at a Tile includes its own config, as a folder's `.hexframe/` names the file beside it; which part names which file or folder is the serializer's (HEX-55). A folder pattern fills in `<n>`, `<slug>` or both, and the ticket's rule applies to the parts around them: each non-empty one is one path segment, so `<n>.<slug>` is refused for its `.` as `..<n>` is, and the whole pattern is at most 255 bytes. A pattern with no placeholder would name every sibling alike, so it is refused too. A kept string holds no line break of any kind (`\n`, `\r`, U+0085, U+2028, U+2029) nor another control character but a tab, and the key `__proto__` is never kept, since a reader assigning keys one by one would take it for the object's prototype. The 4 KB are the UTF-8 bytes of the map as JSON.
