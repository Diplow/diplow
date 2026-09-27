---
title: features
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/features
owner: diplo
preview: >-
  The client's features: what a page is made of beyond the design system, one
  folder each, built from ui/ and composed by a route, with the client bus
  between them. The Conversation beside the canvas and the breadcrumb rail are
  the first two, on fixtures for now.
---
# features

A feature is client code that shows one thing a page needs, in a domain's language, built from [[4-software-engineering/1-projects/1-hexframe/1-app/src/ui/CLAUDE|ui]]. A route composes features; `/dev/system` lays out the first two on fixtures, the Conversation left of the canvas and the breadcrumb right of it.

| Folder | Holds |
|---|---|
| `conversation/` | `Conversation`, Assistant's timeline split by day (`timeline.ts`, pure and tested), its entries (`Entry.tsx`: Messages, navigations, operations), `TileCard` with its show more/less, and the message input; `fixtures.ts`, three days of a Conversation about the fixture System |
| `breadcrumb/` | `Breadcrumb`, the rail of the centered Tile's ancestors; a click centers one. The path comes from `pathTo` in `ui/hex/view/` |
| `access/` | `Access`, the sign-in and sign-up pages' content: one form, an email and a password, whose refusals show on their fields, then back where the user was: [[4-software-engineering/1-projects/1-hexframe/1-app/src/features/access/CLAUDE\|access]] |

| File | Holds |
|---|---|
| `bus.ts` | The client bus: `publish` a fact, `useFact` to react to one, `receive` for a fact crossing into the client. Beside the features, not in one, so a feature reaches it without importing another |

## Rules

- **A feature sits between routes and the API.** dependency-cruiser reads `src/routes/` → `src/features/` → `src/api/`: a feature reaches the server through a server function, never a domain or a repository.
- **Features ignore each other.** A route composes them, and the client bus carries a fact from one to another; `no-feature-importing-another` says no to the import.
- **A fact is declared once, with its schema, where both sides reach it**, as a `Schema.TaggedClass` in the past tense and in a domain's language: in `facts.ts` beside `bus.ts`, created with the first fact, never inside the feature that publishes it, which its listener may not import.
- **A feature reacts through a state hook**: `useFact(TileCentered, actions.recordNavigation)`, passing a stable action, so the hook subscribes once. React subscribes through `useSyncExternalStore`, since `useEffect` stays in `ui/`.
- **A fact crossing into the client is decoded by its schema**, through `receive`, which drops and reports one that does not decode; between features, in one page, its type is enough. Every fact is logged at `medium` (a console line annotated `verbosity: medium`, until HEX-19 sets the levels).
- **A feature builds from ui/ and never adds to it.** A missing component is a Linear ticket (see ui's rules).
- **The view belongs to the URL**, as on the canvas: a feature that changes it calls `onViewChange` with the next view and the route navigates.
