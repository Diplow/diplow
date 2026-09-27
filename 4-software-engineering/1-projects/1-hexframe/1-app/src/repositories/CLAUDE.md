---
title: repositories
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories
owner: diplo
preview: >-
  The bottom layer: Effect layers over the SDKs that hold the technical
  complexity, one folder per SDK family. The database (Drizzle over Neon, PGlite
  in tests) is the first; auth (Better Auth and Stripe) comes with IAM.
---
# repositories

The layer under [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/CLAUDE|domains]]: Effect layers over the libraries that talk to the outside world, so a domain reads and writes in its own language and never meets an SDK. Each folder is the one place its SDKs may be imported (`dependency-cruiser.config.ts`, `sdks`).

| Folder | Holds |
|---|---|
| `database/` | Drizzle over Effect's Postgres client, the committed migrations' runner and the PGlite test harness: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/database/CLAUDE\|database]] |

`auth/`, over Better Auth and its Stripe plugin, arrives with IAM (HEX-18).

## Rules

- **Nothing above imports an SDK.** A domain uses the service a repository provides; a new SDK gets its line in `dependency-cruiser.config.ts` and its folder here.
- **A repository never imports a domain**, nor the API layer: an import only points down.
