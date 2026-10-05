---
title: features
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features
owner: diplo
preview: >-
  The client's features: what a page is made of beyond the design system, one
  folder each, built from ui/ and composed by a route, with the client bus
  between them. The Conversation beside the canvas and the breadcrumb rail came
  first, on fixtures; the user's own System, and what they do to it, next.
---
# features

A feature is client code that shows one thing a page needs, in a domain's language, built from [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/CLAUDE|ui]]. A route composes features; `/dev/system` lays out the first two on fixtures, the Conversation left of the canvas and the breadcrumb right of it, and home lays out the user's own System with the breadcrumb beside it.

| Folder | Holds |
|---|---|
| `conversation/` | `Conversation`, Assistant's timeline split by day (`timeline.ts`, pure and tested), its entries (`Entry.tsx`: Messages, navigations, operations), `TileCard` with its show more/less, and the message input; `fixtures.ts`, three days of a Conversation about the fixture System |
| `breadcrumb/` | `Breadcrumb`, the rail of the centered Tile's ancestors; a click centers one. The path comes from `pathTo` in `ui/hex/view/` |
| `system/` | `System`, the signed-in Account's System on the canvas, and `TileActions`, what the user does to it: add a Tile or import files in an empty slot, a Leaf in a ring of Leaves, import a vault into an empty System, edit, move, export or delete the centered one, grow a Leaf into a Branch or shrink a bare Branch into a Leaf. The view and the change under way live in the URL: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/system/CLAUDE\|system]] |
| `access/` | `Access`, the sign-in and sign-up pages' content: one form, an email and a password, whose refusals show on their fields, then back where the user was: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/access/CLAUDE\|access]] |
| `help/` | `HelpCanvas`, Help on the canvas, read-only, and `HelpTile`, the centered Tile's card, whose button opens its Body in a drawer. The view and the open Body live in the URL: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/help/CLAUDE\|help]] |
| `keys/` | `Keys`, the Keys page's content: issue a Key and see its secret once beside the command that adds hexframe to Claude Code, list the Account's Keys, revoke one: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/keys/CLAUDE\|keys]] |

| File | Holds |
|---|---|
| `bus.ts` | The client bus: `publish` a fact, `useFact` to react to one, `receive` for a fact crossing into the client. Beside the features, not in one, so a feature reaches it without importing another |

## Rules

- **A feature sits between routes and the client's side of the API.** dependency-cruiser reads `front/routes/` → `front/features/` → `front/client/` and `front/ui/` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]]): a feature reaches the server through a server function, never a domain or a repository.
- **Features ignore each other.** A route composes them, and the client bus carries a fact from one to another; `no-feature-importing-another` says no to the import.
- **A fact is declared once, with its schema, where both sides reach it**, as a `Schema.TaggedClass` in the past tense and in a domain's language: in `facts.ts` beside `bus.ts`, created with the first fact, never inside the feature that publishes it, which its listener may not import.
- **A feature reacts through a state hook**: `useFact(TileCentered, actions.recordNavigation)`, passing a stable action, so the hook subscribes once. React subscribes through `useSyncExternalStore`, since `useEffect` stays in `ui/`.
- **A fact crossing into the client is decoded by its schema**, through `receive`, which drops and reports one that does not decode; between features, in one page, its type is enough. Every fact is logged at `medium`, by its tag (`log('bus', …)` from the API layer's observability), and a feature that throws reacting to one is reported to Sentry.
- **A feature builds from ui/ and never adds to it.** A missing component is a Linear ticket (see ui's rules).
- **The view belongs to the URL**, as on the canvas: a feature that changes it calls `onViewChange` with the next view and the route navigates.
