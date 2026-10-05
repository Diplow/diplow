---
title: mapping
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping
owner: diplo
preview: >-
  Mapping, the core domain: someone lays out a System they maintain as a
  hierarchy of Tiles, where what comes first is what matters most. One System
  per Account, whose Root is the user; six Children per Tile, six Context
  slots, References by id; create, edit, move, swap, delete. Over the tiles
  repository; Help, the System hexframe ships, read from the bundle.
---
# mapping

The core domain, the one hexframe exists for. Someone maintains a system (a codebase, a team, their own life) and wants AI to work along their intent. Mapping lets them lay that system out as a hierarchy where what comes first is what matters most: a reader, human or agent, sees one Tile, then the six it breaks into, then theirs. Choosing what to show first is the exercise, and the hierarchy it produces carries the intent.

The language, as [[4-software-engineering/1-projects/1-hexframe/STACK|STACK]] first told it:

- **System**: the whole hierarchy a user maintains. An Account has exactly one, and its **Root** tile is the user: there is no profile beside it. The Root's Title is the user's name everywhere in the app. Mapping adds the Root the first time a System is read, idempotently, so no lost event can leave an Account without one; it starts untitled, until the user names themselves. *Hexframe* is the product and the form, never the thing a user owns.
- **Tile**: the unit. A **Title**, a **Preview** (at most 350 characters: what a reader needs to decide whether to open it) and a **Body** in Markdown.
- **Child**: a Tile in one of its parent's six **Directions**, which say what the parent does and how: 1 NW, 2 NE, 3 E, 4 SE, 5 SW, 6 W. The **Opposite** direction, three away, is a tension the parent balances. A seventh Child is refused: the user regroups some Children under a new one, by moving them. That regrouping is the exercise, not a workaround.
- **Context**: what a Tile *is*, where its Children say what it does. Up to six Context slots, −1 to −6, in the same Directions; each holds a Tile of its own or a Reference. A codebase's Children are its frontend, backend and CI; its Context is the principles it follows.
- **Frame**: a Tile together with its Children.
- **Reference**: a link from a Context slot to another Tile, by id, so it survives a move. A Reference to a deleted Tile shows as broken; it never blocks the delete.
- **Operations**: create, edit, move (a Tile and everything below it), swap (two Tiles trade places, each with everything below it), delete.
- **Help**: a System shipped with hexframe, which no Account owns: every Account reads it, none writes it.

What a user does *to look* at a System is not Mapping: centering on a Tile, expanding and collapsing a Frame, showing the center Tile's Context. It is view state, owned by the URL, so a link shows exactly what its sender saw ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/hex/CLAUDE|hex]]).

| File | Holds |
|---|---|
| `mapping.ts` | The operations, each for one Account. Two reads: `system`, the Root with everything below it, Bodies included, for the canvas; and `readTile`, one Tile (the Root when no id is given, a Tile of Help for a Help id) to a depth of 0 to 3, with only the fields asked of each Tile, and its parent's id and Title, for a reader that opens a Tile before its Children's Bodies. Both add the Root on the first read. Then `createTile`, `editTile`, `moveTile`, `swapTiles`, `deleteTile`, `createReference` and `deleteReference`, each naming its Tiles to `changing`, which refuses Help's first |
| `tile.ts` | `Tile` and its `Content`; `Direction` (1 to 6), `ContextDirection` (−1 to −6) and `Slot`, either; `checked`, what a Tile's content must be, and `previewLimit`, the 350 characters it counts against, which `fitsPreview` counts as a reader does |
| `system.ts` | `SystemTile`, a Tile with its Children and its Context, and the pure reading of the repository's rows: `systemOf`, `below`, the Tile or the Reference in a slot; and `ReadTile`, a Tile as `readTile` finds it, built by `readOf`, with the `fields` a read may ask and the `depths` it may go to: its id and the `Field`s asked, its Children and Context above the read's last generation, a Reference as its Tile's id, Title and Preview |
| `system.test.ts` | That reading on rows made by hand, no database: the Root, a Child and a Context Tile in place, a Reference resolved and a broken one, what holds a slot, what lies below a Tile; and a Tile read to a depth: where it stops, the fields it carries, its References |
| `errors.ts` | Mapping's errors, each with its kind: `TileNotFound` (NotFound); `TitleMissing` and `PreviewTooLong` (Invalid, on the field at fault); `DirectionTaken` and `MovedUnderItself` (Conflict), the latter for a swap along one line too; `RootFixed` and `HelpReadOnly` (Forbidden), the latter for any change naming a Tile of Help |
| `mapping.test.ts` | Mapping over the tiles repository, for real, over PGlite: the Root, the six Directions, Context, References and their breaking, every operation and every refusal, swaps among Children, Context and across the two, and `readTile` at each depth and each choice of fields |

| Folder | Holds |
|---|---|
| `help/` | Help ([[4-software-engineering/1-projects/1-hexframe/1-app/help/CLAUDE\|help]]): `help.ts`, Help read from the notes the help repository bundles (`repositories/help/`), `helpRoot`, `isHelpId`, what names Help and is refused to every change, `HelpId`, the Schema of a well-formed Help id, which the MCP's reads take, `help`, Help read in each language, `readHelp`, which `readTile` calls for a Help id, in English, the MCP's language, and `helpSystem`, Help whole in a language, which `/help` draws; `vault.ts`, a vault folder's notes read as a System's rows, the same ids in every language, its ids the paths of slots from the Root (`help/3/-1`), and what keeps a folder from reading as a Tile, which fails the build (`scripts/check-help.ts`), each problem about a note naming its file; `help.test.ts`, the real folder read in both languages, Help whole in each, Help read at each depth, an id that climbs out refused, every write refused `HelpReadOnly` (`hexframe-app-mcp-server/decisions.md#DEC-15`, `#DEC-18`, `#DEC-19`) |

The rows live in one table, `tile`, through the tiles repository ([[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/database/CLAUDE|database]], `tiles/`). It speaks rows; Mapping decides what a row means and which change is allowed.

## Rules

- **An Account sees its own System, and Help; it writes its own only.** Every operation takes the Account IAM proves for the request (by a Session or a Key), never one the caller sends; a Tile of another Account's System is `TileNotFound`, as a deleted one is, so an id says nothing about whether it exists. Help is read by every Account, and by anyone at `/help`, signed in or not, and written by none: it comes from its folder in the repo, `1-app/help/`, in English and in French, bundled at build time, never from the database nor a Mapping write, and nothing reads the file system at request time. Mapping refuses a write that names a Help Tile (`HelpReadOnly`, Forbidden) whatever schema the caller passed through, a move or a swap with one end in Help included. A Help id is a path from Help's root, looked up in the bundled set of Tiles, never read as a file path. A Reference, for now, points at a Tile of the same System: public Tiles, which anyone can refer to, come with sharing.
- **A change sees the System alone.** It first locks the System's Root (`Tiles.lock`), then checks against the rows as they stand, then writes, all in one transaction. Two changes to one System never interleave, so a slot never holds two Tiles and a move never makes a loop. Mapping neither opens nor commits that transaction: the API layer does (`transactional`), as it will for one that spans domains, and every change's type requires it (`InTransaction`), so none can run outside one. The lock is Mapping's decision, the query the repository's errand (`hexframe-v0-mapping/decisions.md#DEC-3` in the run's registers, where the repository still opened the transaction).
- **The Root is the user.** It is never moved nor deleted (`RootFixed`), and its Title is edited like any Tile's. IAM is to keep a copy of it for emails, but no email is sent yet, so none is kept: `editTile` publishes nothing, and Better Auth's name stays empty. The first email brings the event, the Root's rename on the bus, and the API layer wires IAM to it (`hexframe-v0-mapping/decisions.md#DEC-4`).
- **A swap trades two places whole.** Each Tile takes the other's parent and slot, a Child's Direction or a Context slot alike, with everything below it, so a full ring still lets two Tiles trade. Neither may be the Root (`RootFixed`), nor lie below the other (`MovedUnderItself`), and a Reference has no place of its own to trade (`TileNotFound`). A swap of a Tile with itself changes nothing, as a move to where a Tile stands does.
- **A Reference is where it stands.** It has no content, and no operation but its create and delete, both by its slot: to put one elsewhere, delete it and create another. Moving the Tile that holds it carries it along; deleting the Tile it points at leaves it broken.
- **A Body is read only when asked.** `readTile` walks down one generation per query and selects only the fields asked, so a Body nobody asked for never leaves the database. A Reference shows its Tile's id, Title and Preview whatever was asked, the least a reader needs to decide whether to open it (`hexframe-app-mcp-server/decisions.md#DEC-8`).
- **Only the fields given are checked**, so the Body of an untitled Root can be written before its name. A Preview's 350 characters are counted as a reader counts them, an emoji of several code points being one.

## Later

Sharing, export and the MCP server all take a Tile as their entry point, and everything below it comes along. A Tile can be public by link, so any LLM that can fetch a URL can read it. An agent reads through the MCP server, in the order a human discovers it: a Tile's Children's Previews before any of their Bodies. A System exports as a zipped folder: a folder per Tile, `<n>-<slug>/` for a Child and `.<n>-<slug>/` for a Context tile, holding one Markdown file with the frontmatter (`title`, `parent`, `preview`) and the Body; References become `[[wikilinks]]`. The user can rename the file and the folder pattern (defaults: `CLAUDE.md`, the ones above).
