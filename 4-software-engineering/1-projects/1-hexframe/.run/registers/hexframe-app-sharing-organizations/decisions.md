---
title: decisions, hexframe app Sharing & organizations
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-app-sharing-organizations
owner: diplo
preview: >-
  The choices the autonomous run made while building sharing and
  Organizations, where a ticket left room: who acts apart from whose System
  it is, a System named by its star and found by its owner's id.
---
# decisions, hexframe app Sharing & organizations

### DEC-1 Mapping takes `{ actor, system }`: the System named by its star, found by its owner, checked once in `reached`

HEX-124. Every read and every change of Mapping's service takes `Acting`, `{ actor, system }` (`domains/mapping/mapping.ts`). `system` is the star's id, a string, as the ticket says a System is named and as later tickets will receive it from a request (a Handle is a star's id). `actor` is `{ owners }`, the opaque ids it stands for, an Account's own alone for now: the only thing the check reads. HEX-125 gives it the Account and its Groups when `may` needs them, and moves it to `entities/` beside `may`, since `operations/` will read it there. Until then it stays a type of the service, because `entities/` holds five files and the door has no reader for it.

The check is one function, `reached(acting)`: it reads the owner the star names (`Tiles.ownerOf`, one lookup on the table's key) and answers it when the actor stands for it, `TileNotFound` otherwise, a star that names nothing included. Every read and every change asks it first, then passes the owner it answered to the repository, which finds a System's rows by its owner, as before by the Account. The lock is still the owner's Root, which is the star. A System the API layer pairs with its own idea of the owner was the other way, with no lookup per call: refused, because the pairing would be trusted, where `reached` checks it against the table on every call, and because a later ticket that names a System from a request would have needed a second, minting step.

The API layer resolves the System through Mapping's `ownSystem(account.id)`: the actor `{ owners: [account.id] }` and the Account's star, its Root added untitled on the first read, as `system` and `locked` used to add it. Assistant's programs, the bus's recording and Mapping's tests resolve through the same function, so the tests can't drift from the API (cubic's local review on #141). The API layer still decides which System a request names and whom the Account stands for; `ownSystem` is the one case that needs nothing from IAM. `Tiles.root` now reads before it inserts, so the poll behind `latest`, which now resolves the star too, writes nothing. Each request makes one or two more small queries than before (the star, then its owner), the cost of the seam. `reached` can fail, so the lists of errors `system`, `conversationDay` and `latest` may fail with now include `TileNotFound`, which `api/mapping/mapping.test.ts` and `api/assistant/assistant.test.ts` pin. It can't happen while the API names the Account's own System.

`tile.account_id` is renamed `owner_id`, and its index `tile_ownerId_idx`, by `migrations/20261017191758_tile-owner`, a rename that keeps every row. `tile_root_idx` keeps one star per owner. The database's rule asks a migration on `main` to keep the code before it working. A rename doesn't: between the production build's migration and the new code going live, the old code's queries name a column that no longer exists. The add-backfill-drop way was refused for this run: its window either loses the rows the old code adds (owner null) or leaves the old code's writes refused, and it leaves a dead column for a later change that no ticket of this project owns. The app has no user but Ulysse before launch, and `turn-key-turn-only` dropped a column the same way. Whoever merges `project/sharing` into `main` sees the window here.

`readTile` moved from `mapping.test.ts` to `domains/mapping/testing.ts`, which sat at 599 of its 600 lines. The new case, an actor naming another Account's star or a star of nothing, refused `TileNotFound` on every read, on a change and on `changing`, the import's path, with the owner's System untouched, is in `api/mapping/mapping.test.ts`, where the service's cases go when `mapping.test.ts` is full (`hexframe-app-optimistic-writes-and-patterns/decisions.md#DEC-13`).
