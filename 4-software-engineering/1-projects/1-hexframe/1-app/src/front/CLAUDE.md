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

Everything the browser shows, and the client's side of every call. It sits on top of the layers: `front/` → `api/` → `domains/` → `repositories/`. An import only points down, so neither a domain, nor a repository, nor the API layer can reach what the browser shows; and the front reaches the server through a server function in `src/api/`, never a domain or a repository. dependency-cruiser says no to both (`dependency-cruiser.config.ts`).

| Folder | Holds |
|---|---|
| `routes/` | File routes; `__root.tsx` is the document shell, whose header links a signed-in Account to its System and its Keys, `index.tsx`, home, is the signed-in Account's System, `sign-in` and `sign-up` are IAM's, `settings/keys.tsx` is the Account's Keys, and `dev/` holds the pages served in dev and on previews only, behind the one guard in `dev/route.tsx` |
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
| `calls.ts` | `settle`, which turns an `Outcome` into its value or a thrown `CallFailed`, and the `read` and `write` builders for TanStack Query. A read is keyed `[scope, mode, …key]`, its mode `read` for what a page shows, or `frame` for a read that frames every page, whose failure is reported and shows nothing |
| `channels.ts` | The QueryClient that carries each failure out, `submitWrite` for a form, and `caught`, which reports a bug a `ReadBoundary` catches (a `CallFailed` was already carried out by the QueryClient) |
| `ReadBoundary.tsx` | The nearest boundary of a page's read, mode `read`: its `ErrorState`, or `Forbidden`; a render bug it catches is reported through `caught`. A frame read never reaches it |
| `iam/guard.ts` | `signedInOnly`, a route's `beforeLoad` for a page only a signed-in Account sees; `readSignInSearch`, sign-in's and sign-up's `validateSearch`; `continueTo`, the way back once signed in. Tested: the redirect, and every `redirect` that must not leave the site |
| `iam/keys.ts` | `useKeys`, the Account's Keys, and `AccountKey`, one of them; `useRevokeKey`; and `useIssueKeySubmit`, the issue form's submit, which hands the Key and its secret to its caller and to no cache, and shows a refused name on its field. Every write reads the Keys again once it settles. Tested over stand-ins for the server functions |
| `mapping/queries.ts` | `useSystem`, the read, and `SystemTile`, a Tile of what it returns; one hook per write (`useCreateTile`, `useEditTile`, `useMoveTile`, `useDeleteTile`, `useCreateReference`, `useDeleteReference`); and a form's submit for a new Tile and an edited one (`useCreateTileSubmit`, `useEditTileSubmit`, of type `TileSubmit`), whose refusals show on the fields they name. Tested over stand-ins for the server functions |

## Rules

- **The front never imports a domain, its tests included.** A test that needs a refusal takes it as the client receives it, its wire form decoded (`decodeFailure`), or one of the dev failures (`src/api/dev/failures.ts`).
- **A guarded page guards itself before it renders**, on the server too: `beforeLoad: signedInOnly`. The server function behind it still starts with IAM's `signedIn`; the page's guard is for the user, not for security.
- **`redirect` is a path on this site, without its language prefix.** The guard and the client's Unauthenticated channel (`client/channels.ts`) write it that way, and both untie PostHog's identity (`forget`) before they redirect; sign-in drops anything else, and `continueTo` checks it again against the page's origin before it goes there.
- **The System is one query**, a page's read under the key `['system', 'read']`. Every write reads it again once it settles (it invalidates `['system']`, every mode), whether it succeeded or not, since a refusal such as `DirectionTaken` means the page is out of date; a form's submit too.
- **The header's links show where a guard proved a Session.** `signedInOnly` puts it on the route's context, and the root's header reads the matches for it, so a page makes no call of its own to know; a page without the guard, sign-in or `/dev/ui`, shows none.
- **An edit sends what changed.** `useEditTileSubmit` compares the form with the Tile it opened on and sends only the fields that differ, so the Body of an untitled Root can be written before its name.
- **Every `/dev` page sits under `routes/dev/`**, whose layout route answers 404 in production (`vite.config.ts`, `__DEV_PAGES__`): a page added there is guarded by being there.
