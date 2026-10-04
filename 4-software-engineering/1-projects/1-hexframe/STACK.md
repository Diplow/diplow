---
title: hexframe stack
parent: 4-software-engineering/1-projects/1-hexframe
owner: diplo
preview: >-
  hexframe's technical choices, the rules that come with them, the language of
  its three domains (IAM, Mapping, Assistant) and how a vault reads as a
  hexframe. A TanStack Start app on Vercel, Effect on the server, Neon and
  Drizzle below. Each rule moves into the CLAUDE.md of the folder it governs
  once that folder exists.
---
# hexframe stack

The choices, and the rules they come with. Each rule is written here until the folder it governs exists; then it moves into that folder's `CLAUDE.md` and this file keeps one line and a link. The principles behind all of it are in [[4-software-engineering/2-principles/CLAUDE|Principles]].

## Where the code lives and how it lands

- **Here, in the public `Diplow/diplow` repo.** Every change reaches `main` through a short-lived pull request, hours old rather than days, notes included (see the root [[STACK]]); an autonomous run's units reach it through their initiative branch, below. I do the final merge for now; the direction is to let a green PR merge itself.
- **Each pull request that touches hexframe** runs `check` and `test`, gets a Neon branch and a Vercel preview, then Playwright against that preview. CI is path-filtered to `4-software-engineering/1-projects/1-hexframe/**`, so a note never triggers it.
- **Autonomous runs land on an initiative branch**, which I merge into `main` once its last project is done: see [[4-software-engineering/1-projects/1-hexframe/.run/CLAUDE|.run]].
- **cubic** reviews each pull request through a `cubic.yaml` at the repo root, scoped to hexframe, with three custom agents: maintainability (from the `maintainability-review` skill), domain design (from `domain-design`) and security. The security bar: auth is checked in middleware, no secret reaches the client, every server function input goes through a schema, no raw SQL. The three briefs live in [[4-software-engineering/1-projects/1-hexframe/.cubic/CLAUDE|.cubic]].

## Runtime and versions

- **Vercel**, Node runtime.
- **A package per deployable**, never more: `1-app`, a TanStack Start app holding client and server, `2-claude-mod`, a Claude Code mod that shows a vault folder as a hexframe, and `3-obsidian-plugin`, the Obsidian plugin that does the same inside Obsidian. Mods are in early access; the mod is its own package, so it is the seam.
- **Stable or release candidate; beta and alpha only behind a seam**, one file that can be swapped. So: TanStack Start RC, Effect 4 RC (migrating 3 to 4 later would touch every file), Drizzle v1 RC, whose own Effect driver replaces `@effect/sql-drizzle`, which has no Effect 4 release (HEX-15), and Sentry's alpha TanStack Start SDK behind the observability seam.

| Need | Choice |
|---|---|
| Framework | React 19, TanStack Start, Router |
| Server data | TanStack Query |
| Forms | TanStack Form |
| Tables | TanStack Table v9, inside `ui/` only |
| Shortcuts | TanStack Hotkeys, behind a `hotkeys` seam in `ui/` |
| Tile content | TanStack Markdown (alpha), behind a seam in `ui/`: if it disappoints, the seam is the one file that changes |
| Building a system by conversation | TanStack AI |
| Agents working on a System | An MCP server at `/mcp`, stateless, on `@modelcontextprotocol/server` (v2), imported by the API layer's MCP folder only; a bearer Key proves the Account, OAuth comes later |
| Effects and typed errors | Effect |
| Validation | Effect Schema, everywhere; `zod` is banned by lint |
| Database | Neon, Drizzle through its Effect driver (`drizzle-orm/effect-postgres` over `@effect/sql-pg`; `drizzle-orm/effect-pglite` over `@effect/sql-pglite` in tests) |
| Auth | Better Auth, behind IAM; an Account's Keys through `@better-auth/api-key` |
| Payments | Stripe through `@better-auth/stripe`, behind IAM |
| UI | Tailwind, shadcn |
| Languages | Paraglide JS |
| Errors and alerting | Sentry |
| Analytics and logs | PostHog |

TanStack Store, DB, Pacer, Charts and Virtual stay out until a problem asks for them.

## Shape: the rule of 6 inside the code

Every folder under `1-app/src/` holds at most 6 child folders and 6 files. The rule now lives in [[4-software-engineering/1-projects/1-hexframe/1-app/CLAUDE|1-app]].

## Layers

| Layer | In TanStack Start | Holds |
|---|---|---|
| Front | File routes, the features they compose, the design system, and the client's calls, on TanStack Router, Query and Form | What the browser shows |
| API | Server functions (`createServerFn`) and Start middleware; raw server routes only for inbound webhooks and the MCP endpoint | Plumbing (auth, request id, logging) and the composition of domains |
| Domains | Effect programs, one folder per domain; a service only when it holds state | The business logic, in the domain's language |
| Repositories | Effect layers over Drizzle, Better Auth, Stripe | The technical complexity |

An import only points down, and only the API layer composes domains. The direction and its lint now live in [[4-software-engineering/1-projects/1-hexframe/1-app/CLAUDE|1-app]], each layer's rules in its own folder: [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]], [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/CLAUDE|domains]], [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/CLAUDE|repositories]].

## Effect stops at the server function

Domains, repositories and the API layer are Effect; the client stays on TanStack Query, Form and Router. The two meet in one helper, and nothing else runs a program. The rules now live in [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]].

## Errors

Each domain's errors carry a kind from a closed set; the client decodes them back and the kind and the call pick the channel, never a component's author. The model, the channel table and the message table now live in [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]].

## The bus

One typed bus on the server, one in the client, for facts other parts may react to: a domain publishes, the API layer wires who reacts, and subscribers finish inside the request through `waitUntil`; features tell each other what happened without importing each other. The rules now live in [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]] and [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/CLAUDE|features]].

## State

Every piece of client state has one owner, decided by what the state is. The first line that matches wins:

| The state is | Owner |
|---|---|
| something the server knows | TanStack Query |
| something a link should carry: a filter, a page, the open drawer | Router search params (`validateSearch`, a `.catch` default per field) |
| a value being typed, validated and submitted | TanStack Form (`useAppForm`) |
| anything else, more than a handful | a `use<Thing>State` hook returning `{ state, actions }` |
| anything else, a handful | the component: at most 5 `useState` |

- **Server data is never copied into a reducer**; a reducer holds ids, rows stay in Query's cache.
- **A state hook** is `createSlice` (from RTK, with no store, no provider, no thunk) plus `useReducer`, or `useSyncExternalStore` when the state comes from outside React. A component never sees `dispatch`.
- **No `useEffect` outside `ui/`.**
- **Every state hook has a test** beside it; `state/` folders carry a 90% branch floor.
- **No state outlives a page** except in the URL or Query's cache. Adding some is a decision, not a refactor.

Three small custom lint rules enforce it: the `useState` ceiling, no `dispatch` in a component, a state hook needs a test.

## Design system

`ui/` is a closed list of components I own, in six folders, light and dark from the start. The rules now live in [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/CLAUDE|ui]].

## Lint

`pnpm check` runs the lint set and CI enforces it. The rules now live in [[4-software-engineering/1-projects/1-hexframe/1-app/CLAUDE|1-app]].

## Database

Neon in every deployed environment, one branch per pull request, reached through committed migrations; the PGlite tests run the same ones. The rules now live in [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/database/CLAUDE|database]].

## Tests

Vitest with `@effect/vitest`.

- **Unit**: pure domain functions.
- **Integration**, most of the suite: a server function or a domain service on real repositories over PGlite, an in-memory Postgres. Better Auth runs for real on it; Stripe is a fake layer.
- **End to end**: a few critical journeys, Playwright against the pull request's preview.
- **Components get no tests.** Their logic lives in state hooks, which do.
- **The agent looks at what it built.** A change a user can see is not done until the agent building it has opened it in a browser (claude-in-chrome) and checked it does what the ticket says: the screens it touched, in light and dark, in both languages. Types and tests say the code holds together; only the browser says it lands.

## Domains

Each domain introduces its language with a short story in its `CLAUDE.md`: what it is about and the problems it solves, not an exhaustive glossary. What a domain may import and hold now lives in [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/CLAUDE|domains]].

### IAM

Identity and access: who someone is (an Account, its Sessions, later its Keys), and what they may do (its Entitlements), on Better Auth. The language now lives in [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE|iam]].

### Mapping

The core domain: someone lays out a System they maintain (a codebase, a team, their own life) as a hierarchy of Tiles where what comes first is what matters most, so AI works along their intent. One System per Account, whose Root tile is the user. The language, and what sharing, export and the MCP server will take from it, now live in [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|mapping]].

### Assistant

A conversation with an agent that builds a System on the user's behalf, saving every click. Assistant knows nothing about Tiles: the API layer hands it Mapping's operations as tools.

- **Conversation**: one continuous timeline per Account, split by day. It holds the **Messages** between the user and the agent, and records what the user did on the canvas (navigations, operations), so the agent always knows where the user is. Mapping never hears about views; Assistant is what records them.
- **Proposal**: an operation the agent wants to run, waiting for the user.
- **Mode**, per Conversation, as in Claude Code: *ask* (the default) makes every operation a Proposal, *apply* runs them. An applied batch can be undone.

## A vault as a hexframe

This vault is a hexframe kept as files, the shape a System exports to. claude-mod shows it inside Claude Code, the Obsidian plugin inside Obsidian, and the app will read it one day. What a folder is, and how it reads as a Frame, is written once for all of them in the [[4-software-engineering/1-projects/1-hexframe/2-claude-mod/hooks/shape/CLAUDE|shape]].

How a medium looks at it is view state, as in the app, each medium's own:

- **Frame kind**: which of a Frame's rings shows around its Tile, Children, Branches, Leaves or Context, among those the shape offers. Mapping's Frame is the Children kind of a folder that has no files.
- **Depth**: how many generations a medium shows from the center. claude-mod 1, the app 2, the Obsidian plugin 2.
- **Double expansion**: only the center has it. Its outer ring shows Children, Branches or Leaves; its inner ring, inside the center's hex, Leaves or Context; never the same kind in both. Each outer Branch expands on its own, into any kind. The inner ring's hexes don't expand. Collapsing peels the outer ring first, then the inner, and a fully collapsed center fills the canvas.
- **An overflowing Frame** shows as a list, not as hexes, until exclusions or renames clear it. Only that Frame becomes a list, unless it is the center's outer ring: then the whole view does.
- **Hexframe file**: a `*.hexframe` file opens the view on its folder and keeps the view's state in JSON: the center and the expansions. It is to a medium what the URL is to the app; `diplow.hexframe`, at this vault's root, opens the Obsidian plugin's view on the whole vault. Its paths are relative to the vault, and a medium resolves each one to its real path, symlinks followed, before using it. One that lands outside the vault, through `..`, an absolute path or a symlink, or on an excluded name, is dropped and the file's own folder opens instead, so a shared vault can't make a medium read beyond itself.

Each medium keeps its view state itself. The shape's layout takes the Frame kind and the hexes a view opens, and lays out as many scales as they make; a medium decides both.

## Languages

Bilingual from day one, English and French, with Paraglide: typed message functions, and a missing message fails the build. The code, its identifiers and its message keys are in English.

## Observability

Sentry owns errors, traces and alerting; PostHog, product analytics and the leveled event log. An error reaches PostHog as a small `error` event (kind, code, scope, request id, Sentry event id), never as a second copy of the stack. Three verbosity levels, set per environment (high in production, medium in previews, low in development) and raised for one user by a PostHog feature flag. The rules now live in [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]] and [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/observability/CLAUDE|observability]].
