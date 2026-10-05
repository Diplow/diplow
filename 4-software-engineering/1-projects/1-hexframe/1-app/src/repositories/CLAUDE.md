---
title: repositories
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories
owner: diplo
preview: >-
  The bottom layer: Effect layers over the SDKs that hold the technical
  complexity, one folder per SDK family: the database (Drizzle over Neon, PGlite
  in tests), auth (Better Auth, Stripe to come) and observability (Sentry,
  PostHog); and Help's notes, bundled at build time.
---
# repositories

The layer under [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/CLAUDE|domains]]: the errands of fetching and parsing, so a domain reads and writes in its own language and never meets an SDK nor a file format. An Effect layer where a repository wraps a library that talks to the outside world; plain functions where its data is a constant of the bundle, as Help's notes are. Each folder is the one place its SDKs may be imported (`dependency-cruiser.config.ts`, `sdks`).

| Folder | Holds |
|---|---|
| `database/` | Drizzle over Effect's Postgres client, the committed migrations' runner, the PGlite test harness, and the repositories that query it, Mapping's `tiles/` first: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/database/CLAUDE\|database]] |
| `auth/` | Better Auth over the database, called through its server API, with its test harness; its Stripe plugin comes with Entitlements: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/auth/CLAUDE\|auth]] |
| `help/` | Help's notes, the app's `help/` folder bundled into the server at build time, and the reader of a note's frontmatter: no SDK, but the errands of fetching and parsing, which Mapping leaves here: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/help/CLAUDE\|help]] |
| `observability/` | Sentry and PostHog, on both sides: where errors, traces and the leveled event log go, and the flag that raises one user's verbosity. Plain functions for the browser, Effect services for the server's runtime: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/observability/CLAUDE\|observability]] |

## Rules

- **Nothing above imports an SDK.** A domain uses the service a repository provides; a new SDK gets its line in `dependency-cruiser.config.ts` and its folder here. An SDK that serves requests rather than reaching out, as Start or the MCP server's, is the API layer's ([[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]]).
- **A repository never imports a domain**, nor the API layer: an import only points down. One repository may use another's service, as `auth/` uses the database's.
