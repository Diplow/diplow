---
title: mapping
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/mapping
owner: diplo
preview: >-
  Mapping's side of the API layer: a server function per operation, each for
  the signed-in Account, and the programs they run. The System is one read,
  whole; the TanStack Query hooks over it are the front's.
---
# mapping

Where the client meets [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]]. Each server function checks its input against a schema, then runs one of Mapping's operations through `run`, for the Account the request proves: by its Session here, by its Key at `/mcp`.

| File | Holds |
|---|---|
| `mapping.ts` | The server functions (`system`, `createTile`, `editTile`, `moveTile`, `swapTiles`, `deleteTile`, `createReference`, `deleteReference`) and the schemas of their inputs. The schemas bound every string; what a Title or a Preview must be is Mapping's to say, on the field |
| `programs.ts` | The program behind each server function: IAM's `signedIn`, then the operation for that Account, a change in the transaction it opens (`transactional`); and `readTile`, behind the MCP's `open_tile` and `map` (`server/mcp/tools.ts`). It has a module of its own so the client, which imports `mapping.ts`, never reaches the domain |
| `mapping.test.ts` | The programs through `run`, on the runtime's repositories over PGlite: signed out, every operation, an Account its Key proves, every refusal as it crosses the wire, another Account's System; the schemas; the errors each program lists by its type |

The hooks the client calls these through, one per read and per write, are `front/client/mapping/queries.ts`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]].

## Rules

- **The Account is the one the request proves, never the caller's.** No input names an Account: `programs.ts` takes it from IAM's `signedIn`, whichever proof it was, and a signed-out call is `SignedOut`, which sends the user to sign in.
- **The System is one read.** `system` returns the whole of it (`hexframe-v0-mapping/decisions.md#DEC-6` in the run's registers); the client keeps it as one query and reads it again after every write.
- **Tile ids are UUIDs.** The tiles repository makes every one with `crypto.randomUUID()`, and the schemas refuse any other string, so nothing else reaches the domain.
