---
title: operations
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/operations
owner: diplo
preview: >-
  Mapping's Operations, changes described as data, the events they make, and
  the Decider, decide and evolve, which the server and the client share, pure,
  behind index.ts, the rest of the door the front may import. Every rule of an
  Operation lives in decide, and only there.
---
# operations

How a [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]] System changes, apart from what it is made of ([[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/entities/CLAUDE|entities]]) and how a change loads, writes and publishes (`mapping.ts`). Pure, so the front imports it: `index.ts` is part of Mapping's door, with `entities/index.ts` and `errors.ts`, and the client runs the same `decide` on the System it holds as the service on the one it locked, so the two never disagree on what an Operation does.

| File | Holds |
|---|---|
| `index.ts` | The door: everything below, re-exported, which Mapping's other folders, the API layer and the front import from |
| `operation.ts` | The Operations, `CreateTile`, `EditTile`, `MoveTile`, `SwapTiles`, `DeleteTile`, `CreateReference` and `DeleteReference`, each a tagged class whose every id is a `TileId` (`entities/tile.ts`), a UUID, every string bounded as the server functions bounded it, and each but a create carrying the `Version` its writer read of every existing Tile it changes (`version`, `aVersion` and `bVersion`, `parentVersion`); their closed union `Operation`, so a change Mapping gains fails the typecheck of everything that lists them; and `OperationName`, an Operation's tag in camelCase, the one name of it outside its tag (`hexframe-app-optimistic-writes-and-patterns/decisions.md#DEC-9`) |
| `operation.test.ts` | Each Operation decoded by its tag, and what its schema refuses |
| `events.ts` | The events, `MappingEvent`: what a change did to a System, facts in the past tense, which `evolve` applies, saying nothing of who made them, which the API layer's bus puts on the envelope; `OperationEvent`, those `decide` makes, and `TilesImported`, the one an import's plan makes, the Tile it landed as and how many Tiles came with it |
| `placement.ts` | `Placement`, where a create, a move and an import put a Tile, a slot under a parent Tile, and `freeSlot`, whether a System has it free under a Tile that is no Leaf, which `decide` and `landing/` ask |

| Folder | Holds |
|---|---|
| `decider/` | `decide.ts`, what an Operation does to a flat System: its events in the order they apply, none when it changes nothing, or its refusal, typed apart per Operation by its overloads, a create given the id of what it makes (`Made`), which `decide` never makes, a write naming a Version its Tile no longer has refused `TileChanged`; Help's System, owned by none, takes no change at all. `evolve.ts`, the System after one event, each Tile it changes counted one Version on, an import's the Root it filled, and the System's own Version counted one on for every event. Their tests, on Systems made by hand (`hexframe-app-optimistic-writes-and-patterns/decisions.md#DEC-11`); and `agreement.test.ts`, the Decider against the service over PGlite: for each Operation and its no-ops, `evolve` folded over the events `decide` makes on the System as it stood equals the System read back once the service ran it, Versions included, those events the ones it published, in order, and a write `decide` refuses for a stale Version refused alike, nothing written nor published (`hexframe-app-assistant/decisions.md#DEC-4`) |

## Rules

- **A rule `decide` reads is a `Result`, never an `Effect`**, a plain function of the System (`checked`, `notLeaf`, `holdsNothingIfLeaf`, `freeSlot`), so the browser runs it as the server does.
- **One refusal lives outside `decide`:** a create's id already taken (`TileIdTaken`), which only the whole table knows, since a Tile of another Account's may hold it. The service's write finds it (`mapping.ts`'s `onTaken`).
