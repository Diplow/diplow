---
title: mapping
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/mapping
owner: diplo
preview: >-
  Mapping's side of the API layer: a server function per operation, each for
  the signed-in Account, Help's read for anyone, an export as a streamed zip
  download, an import uploaded as a form, and the programs they run. The
  System is one read, whole; the TanStack Query hooks over it are the front's.
---
# mapping

Where the client meets [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]]. Each server function checks its input against a schema, then runs one of Mapping's operations through `run`, for the Account the request proves: by its Session here, by its Key at `/mcp`.

| File | Holds |
|---|---|
| `mapping.ts` | The server functions (`system`, `help`, `exportTile`, `importTiles`, `createTile`, `editTile`, `moveTile`, `swapTiles`, `deleteTile`, `createReference`, `deleteReference`) and the schemas of their inputs, `HelpLanguage` taking one of the app's locales, `ImportUpload` a form: the file, `as` a zip or one file alone, and `place`, a slot under a Tile or the Root, as JSON. The schemas bound every string; what a Title or a Preview must be is Mapping's to say, on the field |
| `programs.ts` | The program behind each server function: IAM's `signedIn`, then the operation for that Account, a change in the transaction it opens (`transactional`); `help`, Help whole in the language asked, which asks for no Account; `openTile` and `readTile`, behind the MCP's `open_tile` and `map`, which read Help too for a Help id, in English; and `exportTile`, which links a Reference whose Tile the export leaves out by `tileLink`, home centered on it, on the site the request reached; and `importTiles`, which refuses an upload past `uploadLimit`, 4 MB, before anything else, its sender signed in or not, then reads it into a plan outside any transaction, a link on the request's site read back by `tileOfLink`, and lands it in one. The MCP's write tools run the same programs as the server functions, on the same input schemas (`server/mcp/tools.ts`). It has a module of its own so the client, which imports `mapping.ts`, never reaches the domain |
| `download.ts` | An export as it crosses the wire, on both sides and pure: `asDownload`, the server function's answer, the zip as a streamed attachment, `<slug>.zip`, that no cache keeps, or the failure as an `Outcome`; `downloaded`, that answer back as an `Outcome` on the client, the file to save, `Download`, or the failure; `tileLink`, where the app shows a Tile, `/?center=<id>`, which the System page's search test reads back so the two can't drift apart, and `tileOfLink`, the id such a link on the request's site names, which an import reads a Reference's link by |
| `download.test.ts` | An export through `run` over PGlite, answered and read back: its zip holds exactly the files `exportOf` writes, the Root's the whole System; its name and headers; a Reference left out linked on the request's site; another Account's Tile `TileNotFound`; signed out `SignedOut`; its errors by its type |
| `import.test.ts` | An import as a form crosses the wire, encoded and decoded by its schema, through `run` over PGlite: a zip landed in a slot and one file as the Root, with what it created and skipped; past 4 MB refused before anything, signed out or not, its bytes never read; every fault at once and nothing written; a link on the request's site resolved, one elsewhere broken; signed out `SignedOut`; its errors by its type; `tileOfLink` against `tileLink`; the schema |
| `mapping.test.ts` | The programs through `run`, on the runtime's repositories over PGlite: signed out, every operation, Help in both languages signed out or in, an Account its Key proves, every refusal as it crosses the wire, another Account's System; the schemas; the errors each program lists by its type |

The hooks the client calls these through, one per read and per write, are `front/client/mapping/queries.ts`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]].

## Rules

- **The Account is the one the request proves, never the caller's.** No input names an Account: `programs.ts` takes it from IAM's `signedIn`, whichever proof it was, and a signed-out call is `SignedOut`, which sends the user to sign in. `help` alone takes no Account, since Help is no Account's: it answers anyone.
- **Help comes in the page's language.** `help` takes the language as its input, one of the app's locales (Paraglide's `locales`), which the page reads from its URL; a server function's own URL carries no locale. Its program passes it to Mapping, whose type requires a Help in each of them (`hexframe-app-mcp-server/decisions.md#DEC-19`).
- **The System is one read.** `system` returns the whole of it (`hexframe-v0-mapping/decisions.md#DEC-6` in the run's registers); the client keeps it as one query and reads it again after every write.
- **Tile ids are UUIDs.** The tiles repository makes every one with `crypto.randomUUID()`, and the schemas refuse any other string, so nothing else reaches the domain.
- **An import comes as a form, at most 4 MB.** Start hands a server function a `FormData` as it came, so `ImportUpload` decodes it (`Schema.fromFormData`), and the client encodes its form by the same schema. Vercel caps a request's body at 4.5 MB, so the program refuses past 4 MB with `ImportRefused` (`UploadTooLarge`) before it reads a byte or asks who sent it; a larger import goes through storage first, later. The import is no MCP tool (`hexframe-app-import-export/decisions.md#DEC-11`).
- **An export answers a raw `Response`.** Start hands a server function's `Response` to the client untouched, so `exportTile` streams its zip as it is zipped, past the 4.5 MB to which Vercel caps a buffered answer, as Vercel's guide says a streamed one goes, while its failure stays the `Outcome` every server function answers, carried to a write's channel (`hexframe-app-import-export/decisions.md#DEC-9`). Server-foundations' DEC-18 keeps raw server routes for inbound webhooks: the export needs none.
