---
title: api
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api
owner: diplo
preview: >-
  The API layer: server functions, the one helper that runs their Effect
  programs, and the client's side of the seam, where a failure is decoded back
  into its tagged class and sent to the channel its kind and call pick, with a
  message from the table, in English and French.
---
# api

The layer between what the client shows and what the domains know. On the server, a server function (`createServerFn`) is plumbing (auth, request id, logging) and the composition of domains; on the client, the same module is what a route or a feature calls. This folder holds both sides of that seam, and the error model that crosses it.

| Folder | Holds |
|---|---|
| `server/` | `run.ts`, the helper: `RequestContext`, the one `ManagedRuntime` and its repositories, the bus's subscriptions, `run(context, program)` and `provenSession`; `middleware.ts`, Start's middleware, which `src/start.ts` runs before every server function: `sameOriginOnly`, the CSRF check, then `requestContext`; `bus.ts`, the server bus |
| `errors/` | Shared by both sides and pure: `failure.ts`, the union of every failure and its wire form (`Outcome`, `encodeFailure`, `decodeFailure`); `channel.ts`, the channel table; `messages.ts`, the message table. Tested |
| `client/` | `calls.ts`, `settle` and the `read` and `write` builders for TanStack Query; `channels.ts`, the QueryClient that carries each failure out, and `submitWrite` for a form; `ReadBoundary`, the nearest boundary of a read |
| `iam/` | IAM's server functions (`signUp`, `signIn`, `signOut`, `session`) and `guard.ts`: `signedIn`, the `beforeLoad` of a page only a signed-in Account sees, and the `?redirect=` sign-in and sign-up read back |
| `dev/` | The failures, programs and server functions `/dev/errors` uses to provoke every channel. They stay members of `Failure` as long as the page exists; outside dev and previews the functions answer `NotFound` |

## Effect stops at the server function

Domains, repositories and the API layer are Effect. The client stays on TanStack Query, Form and Router, which are promise-native: wrapping them in Effect would fight three libraries for nothing the decoded error union does not already give.

The two meet in one helper. Start middleware stays promise-based and puts the request id, the platform's `waitUntil`, the request's `HttpExchange` and its Session on Start's `context`; every server function hands its program to `run`, which provides that context as Effect services (`RequestContext`, `WaitUntil`, `HttpExchange`, IAM's `CurrentSession`), runs the program on one `ManagedRuntime` built from every layer, and returns an `Outcome`: the value, or the failure encoded with the request id. Nothing else calls `run*`: `eslint.config.ts` says no, and `scripts/lint.test.ts` proves it fires.

The shape every server function takes, here for a Mapping read once that domain exists:

```ts
export const getTile = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(TileRef))
  .handler(({ data, context }) => run(context, Mapping.getTile(data.id)))
```

## Errors

- **Each domain declares its errors** as tagged classes in its own language (`EntitlementMissing`), with `Schema.TaggedError`. Each carries one **kind** from a closed set, as a field: `kind: kind('Forbidden')`, or `...invalid` for an `Invalid` error, which names the form fields at fault. The kinds are in `src/domains/kind.ts`, below every domain, so a domain can declare them without importing the API layer: `Unauthenticated`, `Forbidden`, `Invalid`, `NotFound`, `Conflict`, `Unexpected`.
- **A server function's type lists the errors it can fail with**: its `Outcome<A, E>`. `run` refuses, by its type, a program whose errors are not in `Failure`, the union in `errors/failure.ts`; a domain's errors join it as the domain is built. So a repository's or an infrastructure's typed failure never reaches `run` typed: the domain maps it to one of its own errors, or turns it into a defect (`Effect.orDie`). Defects, interruptions and anything outside the union (a defect beside a declared failure included) collapse to `Unexpected`: reported with the request id (to the server's log until Sentry, HEX-19), never sent as they are.
- **The client decodes the union back into the tagged classes** with Effect Schema. `settle` throws a `CallFailed` holding the decoded failure, the scope and the request id. Anything the union does not know, or a call that never reached the helper, is `Unexpected`.
- **The channel is picked by kind and by the call**, never by a component's author. `errors/channel.ts` is this table, row for row:

| The call | The kind | Channel |
|---|---|---|
| anything | `Unauthenticated` | one redirect to sign-in, carrying where the user was |
| a read | `Forbidden` | the `Forbidden` state: the page worked, the answer is no |
| a read | anything else | `ErrorState` in the nearest `ReadBoundary`, with a retry and the request id |
| a read that frames every page | anything but `Unauthenticated` | reported, nothing on screen |
| a write | `Invalid`, on a form's submit | the form's fields |
| a write | anything else | one toast |

- **The message table** is keyed by `_tag`, optionally narrowed by a scope (the server function's name, which the call names), first match wins, with a fallback per kind, in both languages. The server's own sentence never reaches the screen.
- **A feature writes no error handling**: components never `try/catch` a call, reducers never hold an error. The QueryClient and `submitWrite` send each failure to its channel:
  - a read a page shows is `useQuery(read({ scope, key, call }))`, inside a `ReadBoundary`;
  - a read that frames every page is `useQuery(read({ scope, key, call, frame: true }))`, with no boundary: its failure is reported and it renders nothing;
  - a write is `useMutation(write(scope, call))`;
  - a form's write is `validators.onSubmitAsync: submitWrite({ scope, call, onSaved })`.

Adapted from the error model of a previous project; its channels survive, its HTTP statuses become kinds.

## The server bus

A domain publishes a fact other parts may react to, without knowing who does; this layer, which alone composes domains, wires who reacts. The client has its own bus, between features: [[4-software-engineering/1-projects/1-hexframe/1-app/src/features/CLAUDE|features]].

- **A domain declares its events** in its language, in the past tense (`AccountCreated`), as `Schema.TaggedClass`, and publishes them through `Bus`, from `src/domains/bus.ts`: beside the domains, like `kind.ts`, so a domain reaches it without importing this layer. A domain never subscribes.
- **Subscriptions are wired in `server/run.ts`**, one `on(AccountCreated, reaction)` each, where the reaction calls another domain. The event's schema picks what a subscription hears. A caller that needs a result calls directly: publishing neither fails nor waits, so the bus is never a way to ask.
- **The bus is in-process**, on Effect's `PubSub` (`server/bus.ts`). Each subscription reads it from its own fiber, in the order events were published, for as long as the runtime lives rather than the request. A subscriber that fails is reported and the others carry on.
- **Subscribers finish inside the request.** `run` provides `WaitUntil`, and publishing hands it the work of every subscription that heard the event, so the function stays up until they are done: Vercel's `waitUntil`, which Nitro puts on the request. A lost event is acceptable; the day a subscriber cannot be lost, the bus moves to an outbox table.
- **Inside the process the type is enough.** An event is decoded by its schema only where it crosses a boundary: into the client, into an outbox.
- **Every event is logged at `medium`**: a log line annotated `verbosity: medium`, carrying the event's tag, never its fields, until HEX-19 sets the levels.

## Rules

- **Every server function runs through `run`**, and validates its input with an Effect Schema (`Schema.toStandardSchemaV1`) in `.validator`.
- **Auth is checked in middleware, once.** `middleware.ts` resolves the Session the request's cookie proves (`provenSession`, the one other program `run.ts` runs) before any server function; a function for signed-in Accounts starts its program with IAM's `signedIn`. A lookup that fails (the database is down) is kept as it failed, and `run` fails the program with it: `Unexpected`, with the request id. Before any of it, `sameOriginOnly` refuses a server function call from another site with a 403: the session cookie rides along with every call.
- **The sign-in page is IAM's**: the redirect goes to `/sign-in?redirect=<where the user was>`, in the page's language, the path without its language prefix. A page only a signed-in Account sees guards itself with `beforeLoad: signedIn` (`iam/guard.ts`), which redirects the same way before anything renders, on the server too. Sign-in refuses a `redirect` that is not a path on this site.
- **The runtime's repositories depend on where it runs**, which `run.ts` decides and [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/auth/CLAUDE|auth]] tells.
- **A module the client imports never reaches `run.ts` outside a handler.** Start strips what a server function's handler alone uses, not what the module exports, and `run.ts` carries Better Auth and the database: an Effect program a test needs goes in a module of its own (`dev/programs.ts`).
- **The dev server functions answer `NotFound` outside dev and previews**, as the `/dev` pages answer 404. A malformed call fails Start's validation first, which runs before the handler, and reaches the client as `Unexpected`.
