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
- **A package per deployable**, never more: `1-app`, a TanStack Start app holding client and server, and `2-mod`, a Claude Code mod that shows a vault folder as a hexframe. Mods are in early access; the mod is its own package, so it is the seam.
- **Stable or release candidate; beta and alpha only behind a seam**, one file that can be swapped. So: TanStack Start RC, Effect 4 RC (migrating 3 to 4 later would touch every file), Drizzle v1 RC if `@effect/sql-drizzle` supports it (0.45 otherwise), and Sentry's alpha TanStack Start SDK behind the observability seam.

| Need | Choice |
|---|---|
| Framework | React 19, TanStack Start, Router |
| Server data | TanStack Query |
| Forms | TanStack Form |
| Tables | TanStack Table v9, inside `ui/` only |
| Shortcuts | TanStack Hotkeys, behind a `hotkeys` seam in `ui/` |
| Tile content | TanStack Markdown (alpha), behind a seam in `ui/`: if it disappoints, the seam is the one file that changes |
| Building a system by conversation | TanStack AI |
| Effects and typed errors | Effect |
| Validation | Effect Schema, everywhere; `zod` is banned by lint |
| Database | Neon, Drizzle through `@effect/sql-drizzle` |
| Auth | Better Auth, behind IAM |
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
| API | Server functions (`createServerFn`) and Start middleware; raw server routes only for inbound webhooks | Plumbing (auth, request id, logging) and the composition of domains |
| Domains | Effect services, one folder per domain | The business logic, in the domain's language |
| Repositories | Effect layers over Drizzle, Better Auth, Stripe | The technical complexity |

Domains ignore each other; only the API layer composes them.

## Effect stops at the server function

Domains, repositories and the API layer are Effect. The client stays on TanStack Query, Form and Router, which are promise-native: wrapping them in Effect would fight three libraries for nothing the decoded error union does not already give.

The two meet in one helper. Start middleware stays promise-based and puts the request id and the Session on Start's `context`; every server function hands its program to the helper, which provides that context as Effect services, runs the program on one `ManagedRuntime` built from every layer, and returns the value or the serialized error. Nothing else calls `run*`: a lint says no.

## Errors

- **Each domain declares its errors** as tagged classes in its own language (`EntitlementMissing`). Each carries one **kind** from a closed set: `Unauthenticated`, `Forbidden`, `Invalid` (with field errors), `NotFound`, `Conflict`, `Unexpected`.
- **A server function's type lists the errors it can fail with.** Repository and infrastructure failures collapse to `Unexpected`: reported to Sentry with the request id, never shown as they are.
- **The client decodes the union back into the tagged classes** with Effect Schema.
- **The channel is picked by kind and by read or write**, never by a component's author:

| The call | The kind | Channel |
|---|---|---|
| anything | `Unauthenticated` | one redirect to sign-in, carrying where the user was |
| a read | `Forbidden` | the `Forbidden` state: the page worked, the answer is no |
| a read | anything else | `ErrorState` in the nearest boundary, with a retry and the request id |
| a read that frames every page | anything but `Unauthenticated` | reported, nothing on screen |
| a write | `Invalid`, on a form's submit | the form's fields |
| a write | anything else | one toast |

- **The message table** is keyed by `_tag`, optionally narrowed by a scope (a server function's name or a route id), first match wins, with a fallback per kind, in both languages.
- **A feature writes no error handling**: components never `try/catch` a call, reducers never hold an error, and the server's own sentence never reaches the screen.

Adapted from the error model of a previous project; its channels survive, its HTTP statuses become kinds.

## The bus

One typed bus on the server, one in the client, for facts other parts may react to.

- **An event is a fact in the past tense**, declared by the domain that emits it, in its language (`AccountCreated`), with an Effect Schema.
- **Subscriptions are wired in the API layer**, since only it composes domains. A caller that needs a result calls directly; the bus is never a way to ask.
- **The server bus is in-process** (Effect `PubSub`); subscribers finish inside the request through `waitUntil`, and a lost event is acceptable. The day a subscriber cannot be lost, the bus moves to an outbox table.
- **The client bus** carries facts between sibling features, which may not import each other.
- **A message is decoded by its schema where it crosses a boundary** (into the client, into an outbox); inside one process the type is enough.
- Every message is logged at `medium`.

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

`ui/` is a closed list of components I own, in six folders, light and dark from the start. The rules now live in [[4-software-engineering/1-projects/1-hexframe/1-app/src/ui/CLAUDE|ui]].

## Lint

`pnpm check` runs the lint set and CI enforces it. The rules now live in [[4-software-engineering/1-projects/1-hexframe/1-app/CLAUDE|1-app]].

## Database

Neon in every deployed environment, one branch per pull request. Migrations are generated by `drizzle-kit generate` and committed; CI applies them to the pull request's branch before its preview deploys, and to production before production deploys. `push` is for local dev only. The PGlite tests run the same migrations.

## Tests

Vitest with `@effect/vitest`.

- **Unit**: pure domain functions.
- **Integration**, most of the suite: a server function or a domain service on real repositories over PGlite, an in-memory Postgres. Better Auth runs for real on it; Stripe is a fake layer.
- **End to end**: a few critical journeys, Playwright against the pull request's preview.
- **Components get no tests.** Their logic lives in state hooks, which do.
- **The agent looks at what it built.** A change a user can see is not done until the agent building it has opened it in a browser (claude-in-chrome) and checked it does what the ticket says: the screens it touched, in light and dark, in both languages. Types and tests say the code holds together; only the browser says it lands.

## Domains

Each domain introduces its language with a short story in its `CLAUDE.md`: what it is about and the problems it solves, not an exhaustive glossary.

### IAM

Identity and access: who someone is, and what they may do.

- **Account**: someone known to hexframe. Its name is not IAM's to decide: the user is their Root tile in Mapping, and the name Better Auth keeps for emails is copied from that Tile's Title, never the other way.
- **Session**: an Account's proven presence, for a while, on one device.
- **Key**: a credential an Account issues to a program (an MCP client, a script) and can revoke. Whether a Key can be limited to one Tile or to reading, and how OAuth clients fit beside it, is settled when the MCP server is built.
- **Entitlement**: something an Account may do. It is derived, when asked, from what the Account pays for, so it never drifts from Stripe.

Better Auth and its Stripe plugin are repositories below IAM; the plugin owns the subscription tables and the Stripe webhook. No domain says "billing". AI usage is what a paid Entitlement buys; the structure itself stays free.

### Mapping

The core domain. Someone maintains a system (a codebase, a team, their own life) and wants AI to work along their intent. Mapping lets them lay that system out as a hierarchy where what comes first is what matters most: a reader, human or agent, sees one tile, then the six it breaks into, then theirs. Choosing what to expose first is the exercise, and the hierarchy it produces carries the intent.

- **System**: the whole hierarchy a user maintains. An Account has exactly one, and its **Root** tile is the user: there is no profile beside it. The Root's Title is the user's name everywhere in the app. Mapping ensures the Root the first time a System is read, idempotently, so no lost event can leave an Account without one. *Hexframe* is the product and the form, never the thing a user owns.
- **Tile**: the unit. A **Title**, a **Preview** (at most 350 characters: what a reader needs to decide whether to open it) and a **Body** in Markdown.
- **Child**: a Tile in one of its parent's six **Directions**, which say what the parent does and how: 1 NW, 2 NE, 3 E, 4 SE, 5 SW, 6 W. The **Opposite** direction, three away, is a tension the parent balances. A seventh Child is refused: the user regroups some Children under a new one, by moving them. That regrouping is the exercise, not a workaround.
- **Context**: what a Tile *is*, where its Children say what it does. Up to six Context slots, −1 to −6, in the same Directions; each holds a Tile of its own or a Reference to any Tile the user can read, a public one in someone else's System included. A codebase's Children are its frontend, backend and CI; its Context is the principles it follows.
- **Frame**: a Tile together with its Children.
- **Reference**: a link from one Tile to another, by id, so it survives a move. A reference to a deleted Tile shows as broken; it never blocks the delete.
- **Operations**: create, edit, move (a Tile and everything below it), delete.

What a user does *to look* at a System is not Mapping: centering on a Tile, expanding and collapsing a Frame, showing the center Tile's Context. It is view state, owned by the URL, so a link shows exactly what its sender saw.

Sharing, export and the MCP server all take a Tile as their entry point, and everything below it comes along. A Tile can be public by link, so any LLM that can fetch a URL can read it. An agent reads through the MCP server, in the order a human discovers it: a Tile's Children's Previews before any of their Bodies. A System exports as a zipped folder: a folder per Tile, `<n>-<slug>/` for a Child and `.<n>-<slug>/` for a Context tile, holding one Markdown file with the frontmatter (`title`, `parent`, `preview`) and the Body; References become `[[wikilinks]]`. The user can rename the file and the folder pattern (defaults: `CLAUDE.md`, the ones above).

### Assistant

A conversation with an agent that builds a System on the user's behalf, saving every click. Assistant knows nothing about Tiles: the API layer hands it Mapping's operations as tools.

- **Conversation**: one continuous timeline per Account, split by day. It holds the **Messages** between the user and the agent, and records what the user did on the canvas (navigations, operations), so the agent always knows where the user is. Mapping never hears about views; Assistant is what records them.
- **Proposal**: an operation the agent wants to run, waiting for the user.
- **Mode**, per Conversation, as in Claude Code: *ask* (the default) makes every operation a Proposal, *apply* runs them. An applied batch can be undone.

## A vault as a hexframe

This vault is a hexframe kept as files: a folder per Tile, its `CLAUDE.md` for the Body, the shape a System exports to. claude-mod shows it inside Claude Code, the Obsidian plugin inside Obsidian, and the app will read it one day. If each medium read a folder its own way, the same vault would show as two hexframes, so they all read it by the rules below. The root [[STACK]] lays out the same slots from the repo's side: its children are the Branches, its files the Leaves, its inner children the Context.

The section borrows Mapping's Tile, Context and Frame, and adds words for what a System doesn't have: files beside folders. A folder holds up to six Branches and six Leaves, and a Frame still draws at most six hexes around its Tile.

What a folder is:

- **Tile**: a folder's own is the `title` and `preview` of its `CLAUDE.md`, or of its `-CLAUDE.md` when it keeps a private one. Without either, a title made from the folder's name.
- **Branch** and **Leaf**: a child folder and a file. A Leaf grows into a Branch when it needs children of its own, and keeps its direction: `3-games.md` becomes `3-games/`. Branches and Leaves count their directions apart: `<n>-<slug>` sits in direction n, and an unnumbered name takes the first free direction in name order. When two names claim one number, the later in name order overflows. A folder's `CLAUDE.md` and `-CLAUDE.md` are its Tile, never Leaves, and a dot file is neither a Leaf nor Context.
- **Context**: the dot folders. `.<n>-<slug>/` sits in direction n, as hexframe exports a System, then the other dot folders (`.claude/`, `.skills/`) take the free slots in name order.
- **`.hexframe/` folder**: a folder's settings. Its `exclusions.yaml` lists the names and globs that folder leaves out, for that folder only. `.hexframe/` itself is always left out, as are `.git` and `node_modules`.
- **The vault's edge**: a medium reads nothing outside the vault. It follows a symlink only when the symlink's real path stays under the vault root's; any other symlink is left out like an excluded name.
- **Overflow**: a candidate that finds no direction, because its ring already has six or because its number is taken.

How a medium looks at it. This is view state, as in the app:

- **Frame kind**: what a Frame's ring shows around its Tile. **Children** is the Branches and the Leaves together, offered only when there are six or fewer in all; the Leaves get another fill, and a Leaf that shares a Branch's number gets a subtle warning. **Branches** and **Leaves** show one of the two, **Context** the dot folders. Mapping's Frame is the Children kind of a folder that has no files.
- **Depth**: how many generations a medium shows from the center. claude-mod 1, the app 2, the Obsidian plugin 2.
- **Double expansion**: only the center has it. Its outer ring shows Children, Branches or Leaves; its inner ring, inside the center's hex, Leaves or Context; never the same kind in both. Each outer Branch expands on its own, into any kind. The inner ring's hexes don't expand. Collapsing peels the outer ring first, then the inner, and a fully collapsed center fills the canvas.
- **An overflowing Frame** shows as a list, not as hexes, until exclusions or renames clear it. Only that Frame becomes a list, unless it is the center's outer ring: then the whole view does.
- **Hexframe file**: a `*.hexframe` file opens the view on its folder and keeps the view's state in JSON: the center and the expansions. It is to a medium what the URL is to the app; the Obsidian plugin will put a `diplow.hexframe` at this vault's root. Its paths are relative to the vault, and a medium resolves each one to its real path, symlinks followed, before using it. One that lands outside the vault, through `..`, an absolute path or a symlink, is dropped and the file's own folder opens instead, so a shared vault can't make a medium read beyond itself.

The reading rules, the vault's edge with the path check it implies, and the layout that takes a depth, move into `1-hexframe/.shape/` when the ticket that extracts the shared shape lands, as the one pure definition every medium reads through; this section then keeps one line and a link. The rest of the view state stays each medium's.

## Languages

Bilingual from day one, English and French, with Paraglide: typed message functions, and a missing message fails the build. The code, its identifiers and its message keys are in English.

## Observability

- **Sentry** owns errors, traces and alerting.
- **PostHog** owns product analytics and the leveled event log. An error reaches PostHog as a small `error` event (kind, code, scope, request id, Sentry event id), never as a second copy of the stack.
- **Verbosity** is set per environment and can be raised for one user by a PostHog feature flag:

| Level | Logs | Where by default |
|---|---|---|
| high | page visits, action clicks and shortcuts, API calls, errors | production |
| medium | high, plus domain service calls, state actions, bus messages | previews |
| low | medium, plus information logs, repository and database calls, renders | dev (renders only ever in dev) |
