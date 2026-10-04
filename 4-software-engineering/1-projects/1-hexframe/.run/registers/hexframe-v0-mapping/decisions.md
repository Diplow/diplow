---
title: decisions, hexframe v0 Mapping
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-v0-mapping
owner: diplo
preview: >-
  The choices the autonomous run made while building hexframe v0's Mapping,
  where a ticket left room: one table for Tiles and References, where the
  tiles repository sits, how a change keeps a System consistent, how the Root
  starts, what a Reference can do, and how the System is read; then how the
  app reaches Mapping: where its server functions sit, what their inputs
  allow, and how the client keeps the System fresh; then the canvas on real
  data: home is the System, what each gesture changes, and what the URL holds.
---
# Decisions

### DEC-1 One `tile` table holds Tiles and References, and the database keeps the slots, the Roots and the deletes

HEX-21, [#18](https://github.com/Diplow/diplow/pull/18). A Context slot holds a Tile or a Reference, never both, so both live in one table where a unique index on `(parent_id, direction)` keeps one row per slot. A row with a `target` is a Reference, and its content columns stay empty. A partial unique index keeps one Root per Account, so reading a System twice at once adds one Root. A self-referencing key with `ON DELETE CASCADE` deletes everything below a deleted Tile. A Reference's `target` has no key, so it stays and shows as broken. `account_id` has no key to Better Auth's `user`: Mapping ignores IAM, and its tests need no Account.

### DEC-2 Mapping's repository is `repositories/database/tiles/`, a folder inside the database's

HEX-21, [#18](https://github.com/Diplow/diplow/pull/18). A repository that queries needs `drizzle-orm`'s operators, which only `repositories/database/` may import, and that folder already holds six files. So the tiles repository is a child folder of it. It speaks rows (`TileRow`), like `auth/` speaks Better Auth's words, and Mapping decides what a row means. The next repository that queries goes beside it.

### DEC-3 Each change locks the System's Root in a transaction; Mapping checks, then writes

HEX-21, [#18](https://github.com/Diplow/diplow/pull/18). Refusing a taken slot or a move below itself means reading the System before writing. `Tiles.change` opens a transaction, locks the Root row with `SELECT … FOR UPDATE`, reads the System's rows and hands them to Mapping, which checks them in memory and writes through `Writes`, which exists only inside a change. Two changes to one System queue on the Root, so no check goes stale before its write. The unique index is the backstop: a write it refuses is a defect, `Unexpected`.

### DEC-4 The Root starts untitled, and IAM's copy of the name waits until it is needed

HEX-21, [#18](https://github.com/Diplow/diplow/pull/18). Mapping knows an Account by its id only, so the Root it adds on the first read has an empty Title until the user names themselves. Checking only the fields an edit gives lets them write the Root's Body before its name. STACK.md has IAM keep a copy of the name for emails, and no email is sent yet. So Mapping publishes nothing for now. When one is needed, Mapping publishes the Root's rename on the bus and the API layer wires IAM to it.

### DEC-5 A Reference is addressed by its slot, cannot move, and points within its own System for now

HEX-21, [#18](https://github.com/Diplow/diplow/pull/18). A Reference has no content and no identity a user sees, so `createReference` and `deleteReference` take the holder and the Context slot, and a Reference moves only with the Tile that holds it. To put one elsewhere, delete it and create another. `deleteReference` on a slot that holds no Reference does nothing, and never deletes a Tile. STACK.md lets a Reference point at a public Tile of someone else's System, but public Tiles come with sharing. Until then a target outside the System is `TileNotFound`, like any Tile of another System, so an id never tells whether it exists.

### DEC-6 `system` reads the whole System at once, Bodies included; a Preview's limit counts graphemes

HEX-21, [#18](https://github.com/Diplow/diplow/pull/18). The canvas opens a System at its Root and expands in place, and a System is hundreds of Tiles, not millions. So one read returns the Root with everything below it, each Tile with its Children by Direction and its Context by slot, and each Reference with the Tile it points at. A read per Frame can come when a System outgrows it. The 350-character Preview is counted with `Intl.Segmenter`, so an emoji of several code points counts as one character.

### DEC-7 Each domain's side of the API layer sits under `api/domains/`

HEX-22, [#19](https://github.com/Diplow/diplow/pull/19). `src/api/` already held six folders (`server/`, `errors/`, `client/`, `iam/`, `dev/`, `observability/`), the rule of 6's cap, so a seventh for Mapping was refused. IAM's folder moved to `api/domains/iam/` and Mapping's sits beside it in `api/domains/mapping/`, as Assistant's will. The rest of `api/` is the plumbing every domain shares. The path mirrors `src/domains/<domain>/`, and dependency-cruiser's rules, anchored at `^src/domains/`, do not read it as a domain.

### DEC-8 Mapping's server functions take flat inputs, bounded on every string, and never an Account

HEX-22, [#19](https://github.com/Diplow/diplow/pull/19). Each input is one flat struct (`{ id, parent, slot }` to move a Tile, `{ id, title?, preview?, body? }` to edit one), checked by an Effect Schema before the handler: a Child's Direction is 1 to 6, a Context slot −1 to −6, and a Reference goes in a Context slot only. The bounds keep anything unbounded from the domain, like IAM's: an id at most 64 characters, a Title 1,000, a Body 100,000. The Preview's bound is 8,000 UTF-16 units, far above Mapping's 350 characters, since one character a reader sees can take many units. A call over a bound fails Start's validation and reaches the client as `Unexpected`; what a Title and a Preview must be stays Mapping's to say, on the field. No input names an Account: each program takes it from IAM's `signedIn`, and each lives in `programs.ts` so the client bundle never reaches the domain.

### DEC-9 The System is one query, read again after every write, and the database joins the runtime

HEX-22, [#19](https://github.com/Diplow/diplow/pull/19). Following DEC-6, the client holds one query, `['system', …]`, and `useSystem` reads it. Each write hook (`useCreateTile` and the others) reads it again once the write settles, whether it succeeded or failed, since a refusal such as `DirectionTaken` or `TileNotFound` means the page is behind. No write updates the cache optimistically yet: the canvas (HEX-23) can add it where a wait shows. The deployed `Database` layer joins the server function runtime beside Better Auth, with the tiles repository over it, as `hexframe-v0-server-foundations/decisions.md#DEC-9` planned. Under `pnpm dev` and the tests, the tiles repository shares `TestAuth`'s PGlite.

### DEC-10 Home is the signed-in Account's System

HEX-23. The canvas needed a page. `/` held a hello from the scaffold, and sign-in and sign-up already land there when no `redirect` names another page. So `/` became the System, guarded by IAM's `signedIn`: a signed-out visit goes to sign-in and comes back, and signing in lands on one's own System. The hello's messages went with it. `/dev/hex` and `/dev/system` stay on fixtures, since they show the canvas and the page's layout in every state a fixture can hold.

### DEC-11 An empty slot adds a Tile; the centered Tile is the one edited, moved or deleted

HEX-23. The canvas has no menu per Tile, and adding one to `ui/` is a component the design system does not have. So each operation takes the gesture the canvas already offers. A click on an empty slot opens the new Tile's form for that slot, a Child or a Tile of the centered Tile's Context. Edit, move and delete act on the centered Tile, from a card beside the canvas, where a double-click puts any Tile. A move is a mode: the next empty slot clicked is where the Tile goes, and the canvas can be navigated meanwhile to reach a slot in another Frame. The Root is only edited, since `RootFixed` refuses the rest. To make the empty slot usable, `ui/hex`'s `Canvas` takes `emptySlots`, the action and accessible name the caller gives it, as it takes `onViewChange`: the canvas grew from inside `ui/`, and the feature adds nothing to it.

### DEC-12 The change under way lives in the URL beside the view

HEX-23. STACK.md puts the open drawer in the search params. So the page's search params carry the canvas's view, then at most one change: `add` and `slot` for the new Tile's form, `edit` for a Tile's, `move` for a Tile being moved. Each falls back on its own when the URL gets it wrong, as the view's fields do. A link opens the same form or the same move, a view change keeps the change, and a new change replaces the old. No state hook was needed, so the page has none.

### DEC-13 The canvas draws a Reference as its Tile, under that Tile's id; an edit sends only what changed

HEX-23. The canvas takes plain Tiles, while a Context slot may hold a Reference. Drawn under the id of the Tile it points at, a Reference centers on that id and every action on it reaches the Tile itself. A broken one is drawn as broken, under an id no Tile has, so no action finds a Tile behind it. The untitled Root is drawn as untitled. The forms submit through the API layer's `submitWrite`, so a refusal shows on its field, and the System is read again once the write settles, as DEC-9 has every write do. An edit sends only the fields that changed, so the Root's Body can be written before its name (DEC-4). Nothing is updated optimistically: every write came back within a moment in the browser, so no wait shows yet.
