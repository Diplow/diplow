---
title: repositories
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories
owner: diplo
preview: >-
  The bottom layer: Effect layers over the SDKs that hold the technical
  complexity, one folder per SDK family: the database (Drizzle over Neon, PGlite
  in tests), auth (Better Auth, Stripe to come), observability (Sentry,
  PostHog), zip archives (fflate) and the agent's sandbox (Blaxel) and model
  relay (Anthropic, plain fetch); and the notes of the Systems hexframe ships,
  Help and the tutorial, bundled at build time.
---
# repositories

The layer under [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/CLAUDE|domains]]: the errands of fetching and parsing, so a domain reads and writes in its own language and never meets an SDK nor a file format. An Effect layer where a repository wraps a library that talks to the outside world; plain functions where its data is a constant of the bundle, as the shipped Systems' notes are. Each folder is the one place its SDKs may be imported (`dependency-cruiser.config.ts`, `sdks`).

| Folder | Holds |
|---|---|
| `database/` | Drizzle over Effect's Postgres client, the committed migrations' runner, the PGlite test harness, and the repositories that query it, Mapping's `tiles/` first: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/database/CLAUDE\|database]] |
| `auth/` | Better Auth over the database, called through its server API, with its test harness; and the allowlist, the Accounts let into the Assistant by hand, which its Stripe plugin replaces: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/auth/CLAUDE\|auth]] |
| `shipped/` | The notes of the Systems hexframe ships, the app's `help/` and `tutorial/` folders bundled into the server at build time, and the reader of a note's frontmatter: no SDK, but the errands of fetching and parsing, which Mapping leaves here: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/shipped/CLAUDE\|shipped]] |
| `observability/` | Sentry and PostHog, on both sides: where errors, traces and the leveled event log go, and the flag that raises one user's verbosity. Plain functions for the browser, Effect services for the server's runtime: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/observability/CLAUDE\|observability]] |
| `agent/` | What a Turn of the Assistant runs on: `sandbox/`, Blaxel (`@blaxel/core`), an Account's sandbox holding its System as read-only files and running the agent's processes, and its fake on this machine for the tests and `pnpm dev`; and `anthropic/`, the model relay, plain `fetch`, a Turn's calls to Anthropic with the platform's key added and their answers relayed as they come, and its fake in the process: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/agent/CLAUDE\|agent]] |
| `zip/` | fflate: a list of files streamed into a zip archive, for an export, and an archive a user sends unpacked in memory, counted as it inflates, for an import, through the `Zip` service on the server; plain functions for the browser, which unpacks a zip the user gave and zips an import before its upload; and, for tests, archives written and read back: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/zip/CLAUDE\|zip]] |

## Rules

- **The browser reaches `zip/` as it reaches `observability/`**: through plain functions, `unpacked` and `archived`, which `api/mapping/files/upload.ts` calls in the page to unpack a zip the user gave and zip an import before its upload (`hexframe-app-import-export/decisions.md#DEC-12`).
- **Nothing above imports an SDK.** A domain uses the service a repository provides; a new SDK gets its line in `dependency-cruiser.config.ts` and its folder here, or a folder of a folder here, as `agent/sandbox/` holds Blaxel's. An SDK that serves requests rather than reaching out, as Start or the MCP server's, is the API layer's ([[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]]).
- **A repository never imports a domain**, nor the API layer: an import only points down. One repository may use another's service, as `auth/` uses the database's.
- **What waits on a commit is the caller's, not the repository's.** `transactional` offers `AfterCommit`, a generic hook: work deferred to the transaction's commit, run once it commits, dropped on a rollback. The API layer's bus defers its publishes through it; no repository imports the bus or a `DomainEvent` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/database/CLAUDE|database]]).
