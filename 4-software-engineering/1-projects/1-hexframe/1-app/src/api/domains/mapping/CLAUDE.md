---
title: mapping
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/domains/mapping
owner: diplo
preview: >-
  Mapping's side of the API layer: a server function per operation, each for
  the signed-in Account, and a TanStack Query hook per read and per write. The
  System is one query, read again after every write.
---
# mapping

Where the client meets [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]]. Each server function checks its input against a schema, then runs one of Mapping's operations through `run`, for the Account the request's Session proves.

| File | Holds |
|---|---|
| `mapping.ts` | The server functions (`system`, `createTile`, `editTile`, `moveTile`, `deleteTile`, `createReference`, `deleteReference`) and the schemas of their inputs. The schemas bound every string; what a Title or a Preview must be is Mapping's to say, on the field |
| `programs.ts` | The program behind each server function: IAM's `signedIn`, then the operation for that Account. It has a module of its own so the client, which imports `mapping.ts`, never reaches the domain |
| `queries.ts` | `useSystem`, the read, and `SystemTile`, a Tile of what it returns; one hook per write (`useCreateTile`, `useEditTile`, `useMoveTile`, `useDeleteTile`, `useCreateReference`, `useDeleteReference`); and a form's submit for a new Tile and an edited one (`useCreateTileSubmit`, `useEditTileSubmit`, of type `TileSubmit`), whose refusals show on the fields they name |
| `mapping.test.ts` | The programs through `run`, on the runtime's repositories over PGlite: signed out, every operation, every refusal as it crosses the wire, another Account's System; the schemas; the errors each program lists by its type |
| `queries.test.ts` | The hooks over stand-ins for the server functions: what each calls, and the System read again after a write, a form's submit included |

## Rules

- **The Account is the Session's, never the caller's.** No input names an Account: `programs.ts` takes it from IAM's `signedIn`, and a signed-out call is `SignedOut`, which sends the user to sign in.
- **The System is one query.** `system` returns the whole of it (`hexframe-v0-mapping/decisions.md#DEC-6` in the run's registers), under the key `['system', …]`. Every write reads it again once it settles, whether it succeeded or not, since a refusal such as `DirectionTaken` means the page is out of date; a form's submit too.
- **An edit sends what changed.** `useEditTileSubmit` compares the form with the Tile it opened on and sends only the fields that differ, so the Body of an untitled Root can be written before its name.
