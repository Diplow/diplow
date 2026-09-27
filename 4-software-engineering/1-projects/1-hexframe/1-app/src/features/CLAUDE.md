---
title: features
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/features
owner: diplo
preview: >-
  The client's features: what a page is made of beyond the design system, one
  folder each, built from ui/ and composed by a route. The Conversation beside
  the canvas and the breadcrumb rail are the first two, on fixtures for now.
---
# features

A feature is client code that shows one thing a page needs, in a domain's language, built from [[4-software-engineering/1-projects/1-hexframe/1-app/src/ui/CLAUDE|ui]]. A route composes features; `/dev/system` lays out the first two on fixtures, the Conversation left of the canvas and the breadcrumb right of it.

| Folder | Holds |
|---|---|
| `conversation/` | `Conversation`, Assistant's timeline split by day (`timeline.ts`, pure and tested), its entries (`Entry.tsx`: Messages, navigations, operations), `TileCard` with its show more/less, and the message input; `fixtures.ts`, three days of a Conversation about the fixture System |
| `breadcrumb/` | `Breadcrumb`, the rail of the centered Tile's ancestors; a click centers one. The path comes from `pathTo` in `ui/hex/view/` |

## Rules

- **A feature sits between routes and the API.** dependency-cruiser reads `src/routes/` → `src/features/` → `src/api/`: a feature reaches the server through a server function, never a domain or a repository.
- **Features ignore each other.** A route composes them, and the client bus carries a fact from one to another; `no-feature-importing-another` says no to the import.
- **A feature builds from ui/ and never adds to it.** A missing component is a Linear ticket (see ui's rules).
- **The view belongs to the URL**, as on the canvas: a feature that changes it calls `onViewChange` with the next view and the route navigates.
