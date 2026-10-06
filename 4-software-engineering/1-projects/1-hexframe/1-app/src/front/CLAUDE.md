---
title: front
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front
owner: diplo
preview: >-
  The top layer, what the browser shows: the routes, the features they
  compose, the design system, and the client's side of the API, which calls
  the server functions and carries each failure to its channel. Nothing below
  it, the API layer included, may import it; it reaches the server through
  src/api/ only.
---
# front

Everything the browser shows, and the client's side of every call. It sits on top of the layers: `front/` → `api/` → `domains/` → `repositories/`. An import only points down, so neither a domain, nor a repository, nor the API layer can reach what the browser shows; and the front reaches the server through a server function in `src/api/`, never a repository, and of a domain only its door, pure (below). dependency-cruiser says no to both (`dependency-cruiser.config.ts`).

| Folder | Holds |
|---|---|
| `routes/` | File routes; `__root.tsx` is the document shell, whose header links a signed-in Account to its System and its Keys, `index.tsx`, home, is the signed-in Account's System, `sign-in` and `sign-up` are IAM's, `settings/keys.tsx` is the Account's Keys, `help.tsx` is Help, on the canvas, read-only, for anyone, `mcp.ts` is the MCP endpoint, a raw server route handed over whole to the API layer (`api/server/mcp/`), and `dev/` holds the pages served in dev and on previews only, behind the one guard in `dev/route.tsx` |
| `features/` | What a page shows beyond the design system, one folder per feature: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/CLAUDE\|features]] |
| `client/` | The client's side of the API: how a call is made and where its failure goes, and what the client calls each domain's server functions through (below) |
| `ui/` | The design system: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/CLAUDE\|ui]] |

| File | Holds |
|---|---|
| `styles.css` | The theme's tokens, light and dark, and Tailwind's entry |

Inside the front, too, an import only points down: `routes/` → `features/` → `client/` and `ui/`, side by side. A route composes features; neither the client nor the design system imports a feature or a route.

## client

The error model it carries out (the channel table, the message table, a failure's wire form) is the API layer's, shared by both sides: [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]], "Errors".

| Path | Holds |
|---|---|
| `calls.ts` | `settle`, which turns an `Outcome` into its value or a thrown `CallFailed`, and the `read` and `write` builders for TanStack Query. A read is keyed `[scope, mode, …key]`, its mode `read` for what a page shows, or `frame` for a read that frames every page, whose failure is reported and shows nothing. A write is keyed `[scope]`, carries its call in its meta, `write`, or `submit` for a form's, and may name a queue, whose writes run one after another, in order (TanStack Query's mutation `scope`) |
| `channels.ts` | The QueryClient that carries each failure out, a write's by the call its meta names; `submitMutation`, a form's submit through a mutation, which shows the mutation's error on the form, an `Invalid` one on the fields it names; `submitWrite`, a form's submit kept out of every cache, for a write whose input or answer is a secret: signing in or up, issuing a Key; `settleSubmit`, a submit's value or the `Invalid` failure its form shows, any other thrown for its channel, and `caught`, which reports a bug a `ReadBoundary` catches (a `CallFailed` was already carried out by the QueryClient) |
| `ReadBoundary.tsx` | The nearest boundary of a page's read, mode `read`: its `ErrorState`, or `Forbidden`; a render bug it catches is reported through `caught`. A frame read never reaches it |
| `iam/guard.ts` | `signedInOnly`, a route's `beforeLoad` for a page only a signed-in Account sees; `readSignInSearch`, sign-in's and sign-up's `validateSearch`; `continueTo`, the way back once signed in; `provedSession`, whether a route's context holds the Session the guard put there. Tested: the redirect, and every `redirect` that must not leave the site |
| `iam/keys.ts` | `useKeys`, the Account's Keys, and `AccountKey`, one of them; `useRevokeKey`; and `useIssueKeySubmit`, the issue form's submit, which hands the Key and its secret to its caller and to no cache, and shows a refused name on its field. Every write reads the Keys again once it settles. Tested over stand-ins for the server functions |
| `mapping/queries.ts` | `useSystem`, the read: `system`, the System flat as the server answers it and the cache holds it, and `root`, its tree, a `SystemTile` of Mapping's door, built by `systemOf` once per answer; `useHelp`, Help whole in a language, a query per language; `useExportTile`, the export of a Tile, whose zip the browser saves under its name, a refusal in a toast, the System not read again; one hook per write (`useCreateTile`, `useEditTile`, `useMoveTile`, `useSwapTiles`, `useDeleteTile`, `useCreateReference`, `useDeleteReference`), each a mutation keyed by its Operation's name, its variables that Operation's fields, in the System's queue, a create and an edit a form's `submit`; a form's submit for a new Tile and an edited one (`useCreateTileSubmit`, `useEditTileSubmit`, of type `TileSubmit`), through those two mutations, whose refusals show on the fields they name; and `useImportTiles`, an import into an `ImportPlace`, in the same queue, pruned and zipped by `mapping/upload.ts`, then sent, answering `Imported`: landed with the server's report, or refused, by the browser or the server, every fault on its path, either way with what was left out; any other failure goes to a write's channel. Tested over stand-ins for the server functions |
| `mapping/files.ts` | What the user hands an import in the browser, read into `Given` (`mapping/upload.ts`): `pickedFolder`, the files `<input webkitdirectory>` lists, named by their first segment; `pickedFile`, a zip's folder unless the slot takes one file alone (`Takes`); `dropped`, a drop's first file taken while its event lasts, a folder read below through its entries. Only the listing is read here; a file's bytes when the upload asks. Tested over stand-ins for the browser's objects |
| `mapping/upload.ts` | The browser's side of an import, no server function: `prepared`, what the user gave (`Given`: a folder by its files, `GivenFile`, a zip, one file) made into what `importTiles` takes, a folder or a zip pruned of what Mapping's reading leaves out (`LeftOut`), a zip's one wrapping folder unwrapped, checked against the bounds the server unpacks within and its verdict on every path, and zipped, or refused before a byte is sent (`Prepared`). It composes Mapping's pure checks and the zip repository's plain functions, which `api/mapping/files/upload.ts` offers it. Tested on folders, zips and files made by hand: what it leaves out and why, a binary past 1 MB told by its head, every bound and path refused before sending, a wrapped zip unwrapped, and an upload it made landed by the server function's program over PGlite (`hexframe-app-import-export/decisions.md#DEC-12`, `#DEC-16`) |

## Rules

- **The front imports a domain through its door only, its tests included**: its `entities/index.ts`, `operations/index.ts` and `errors.ts`, pure, so a rule, a value or a type of the domain's (Mapping's `Slot`, `directions`, `SystemTile`, `holdsNothing`) is the domain's own and never a copy; anything else of a domain, and every repository, it reaches through a server function in `src/api/`. dependency-cruiser holds it (`no-front-past-a-domains-door`; [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/CLAUDE|domains]], "The door"). A test that needs a refusal as the client receives it takes its wire form decoded (`decodeFailure`), or one of the dev failures (`src/api/dev/failures.ts`).
- **A guarded page guards itself before it renders**, on the server too: `beforeLoad: signedInOnly`. The server function behind it still starts with IAM's `signedIn`; the page's guard is for the user, not for security.
- **`redirect` is a path on this site, without its language prefix.** The guard and the client's Unauthenticated channel (`client/channels.ts`) write it that way, and both untie PostHog's identity (`forget`) before they redirect; sign-in drops anything else, and `continueTo` checks it again against the page's origin before it goes there.
- **The System has one write path.** Every write to it is a mutation, a Tile form's included, so the MutationCache holds each one, pending or refused, for `useMutationState` to find, and they reach the server in the order they were made. A form never sends its write itself: `submitWrite`, which no cache sees, is for a secret only.
- **The System is one query**, a page's read under the key `['system', 'read']`. Every write reads it again once it settles (it invalidates `['system']`, every mode), whether it succeeded or not, since a refusal such as `DirectionTaken` means the page is out of date; a form's submit too.
- **The header's links show where a guard proved a Session.** `signedInOnly` puts it on the route's context, and the root's header reads the matches for it through `provedSession`, so a page makes no call of its own to know; a page without the guard, sign-in or `/dev/ui`, shows none. Help's link is on every page, since anyone reads it.
- **An edit sends what changed.** `useEditTileSubmit` compares the form with the Tile it opened on and sends only the fields that differ, so the Body of an untitled Root can be written before its name.
- **Every `/dev` page sits under `routes/dev/`**, whose layout route answers 404 in production (`vite.config.ts`, `__DEV_PAGES__`): a page added there is guarded by being there.
