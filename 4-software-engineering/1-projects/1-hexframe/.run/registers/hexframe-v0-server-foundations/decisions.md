---
title: decisions, hexframe v0 Server foundations
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-v0-server-foundations
owner: diplo
preview: >-
  The choices the autonomous run made while building hexframe v0's server
  foundations, where a ticket left room: Effect 4 with Drizzle v1's own
  Effect driver, where the error kinds live, what a server function returns,
  how the client carries each channel out, how migrations run, how the two
  buses are placed, kept alive and logged, how IAM sits on Better Auth, and how
  Sentry and PostHog are wired, what they get and at which verbosity.
---
# Decisions

### DEC-1 Effect 4 RC stays; the database goes through Drizzle v1 RC's own Effect driver

HEX-15, [#12](https://github.com/Diplow/diplow/pull/12). `@effect/sql-drizzle` has no Effect 4 release: its latest, 0.51.0, peers `effect ^3.22` and `drizzle-orm <0.50`. Drizzle v1 RC ships `drizzle-orm/effect-postgres` and `drizzle-orm/effect-pglite`, over `@effect/sql-pg` and `@effect/sql-pglite`, both at `4.0.0-rc.117` like the app's `effect`. HEX-16 uses those; STACK.md, the app's CLAUDE.md and the `database` boundary in `dependency-cruiser.config.ts` name them already. The full check is a comment on HEX-15.

### DEC-2 An error carries its kind as a schema field, and the kinds live in `src/domains/kind.ts`

HEX-15, [#12](https://github.com/Diplow/diplow/pull/12). STACK.md says every domain error carries one kind, but a domain may not import the API layer. So the kinds sit in a file beside the domain folders, not inside any of them: `no-domain-importing-another` only matches folders. A domain writes `kind: kind('Conflict')`, or `...invalid` for an `Invalid` error. Because the kind is a field, it travels with the encoded error, and the client picks a channel without knowing the class. `Unexpected` is the helper's alone, so `kind()` doesn't accept it.

### DEC-3 A server function returns an `Outcome`, not a thrown error

HEX-15, [#12](https://github.com/Diplow/diplow/pull/12). The helper returns `{ ok: true, value }` or `{ ok: false, failure, requestId }`, the failure encoded with `Failure`, the app-wide union. Start would serialize a thrown error through seroval and log it as "Server Fn Error!", and a thrown error has no type. An `Outcome` puts the failures a function can end with in its return type, and `run` refuses a program whose errors are not in the union. On the client, `settle` turns it back into the value or a `CallFailed` holding the decoded class. Anything it cannot decode is `Unexpected`, and so is a call that never reached the helper.

### DEC-4 TanStack Query carries the read and write channels

HEX-15, [#12](https://github.com/Diplow/diplow/pull/12). The channel table depends on whether the call was a read or a write, which is what a query and a mutation are, so `@tanstack/react-query` came in with this ticket, one QueryClient per router. Its caches send each failure to the sign-in redirect, a report or a toast, and `throwOnError` hands a read's `Forbidden` or error state to the nearest `ReadBoundary`. A form's write goes through `submitWrite` as TanStack Form's `onSubmitAsync`, so an `Invalid` failure lands on the fields it names. HEX-22's Query hooks build on `read` and `write`. Reads don't retry, since the server already answered; the retry is the error state's button.

### DEC-5 An `Invalid` error names its fields, and the message table words them

HEX-15, [#12](https://github.com/Diplow/diplow/pull/12). The server's sentence never reaches the screen, so an `Invalid` error carries `fields`, the names at fault, and each field shows the error's message from the table, looked up by `_tag` and the call's scope. One error, one sentence: a domain with two different problems on two fields declares two errors.

### DEC-6 Sign-in is `/sign-in?redirect=…`, and reports go to the logs until HEX-19

HEX-15, [#12](https://github.com/Diplow/diplow/pull/12). The redirect channel sends the user to `/sign-in`, in the page's language, carrying where they were. That page doesn't exist until HEX-18, so for now an Unauthenticated call on `/dev/errors` redirects to Not Found. `Unexpected` is reported through Effect's logger with the request id on the server, and a frame read's failure through the browser's console. Both are where Sentry plugs in with HEX-19.

### DEC-7 Drizzle v1 at its `rc5` build, since the `rc` tag crashes against Effect 4 RC

HEX-16, [#13](https://github.com/Diplow/diplow/pull/13). `drizzle-orm@1.0.0-rc.4`, the `rc` tag DEC-1 named, calls `Schema.TaggedErrorClass`, which `effect@4.0.0-rc.117` no longer has (it is `Schema.TaggedError` now), so importing `drizzle-orm/effect-postgres` throws. `1.0.0-rc.5-5935859`, the `rc5` tag, uses the new name and works. `drizzle-orm` and `drizzle-kit` are pinned to it, exactly. It is a build of the next RC, not a beta, and it only reaches `src/repositories/database/`. Move both to the `rc` tag once that catches up.

### DEC-8 The first migration is empty; tables arrive with the domains that own them

HEX-16, [#13](https://github.com/Diplow/diplow/pull/13). No table belongs to this ticket: IAM's come from Better Auth (HEX-18), Mapping's with Tiles. Inventing one to have something to generate would put a word in a domain's language that nobody chose. So `schema.ts` is empty and the first migration, `init`, was generated with `drizzle-kit generate --custom` and holds no statement. It still proves the chain: the migrator records it, on PGlite in the tests and on Postgres through `pnpm db:migrate`.

### DEC-9 The `Database` layer joins the server function runtime with the first domain that reads

HEX-16, [#13](https://github.com/Diplow/diplow/pull/13). The `ManagedRuntime` in `src/api/server/run.ts` builds every layer on its first call, and today that layer is `Layer.empty`. Were `Database` added now, `/dev/errors`, `run.test.ts` and every server function would need `DATABASE_URL` and a live Postgres before any of them reads a row. HEX-18 adds it to `layer` along with IAM, and has to pick how a server function's integration test gets `TestDatabase` in its place.

### DEC-10 One migrator everywhere: Drizzle's Effect migrator, run by `scripts/migrate.ts`

HEX-16, [#13](https://github.com/Diplow/diplow/pull/13). `drizzle-kit migrate` would need a second Postgres driver (`pg`) and would apply migrations with other code than the tests use. `pnpm db:migrate` runs `node scripts/migrate.ts`, which applies them with `drizzle-orm/effect-postgres/migrator` over the same `Database` layer the app uses. The PGlite harness runs the same `migrated` program over its own `Database`. To run without a bundler, the script and `migrations.ts` import with `.ts` paths (`allowImportingTsExtensions`), and `database.ts` imports packages only. A lint keeps `.ts` import paths out of the rest of `src/`, and `scripts/migrate.test.ts` proves the script loads under plain Node.

### DEC-11 A domain publishes through `Bus` in `src/domains/bus.ts`; the API layer builds it and wires its subscriptions in `run.ts`

HEX-17, [#14](https://github.com/Diplow/diplow/pull/14). A domain must publish without importing the API layer, and only the API layer composes domains. So the port, `Bus` and `DomainEvent`, sits beside the domain folders like `kind.ts` (DEC-2), and the PubSub behind it, with `on(Event, reaction)`, is `src/api/server/bus.ts`. The subscriptions are a list in `run.ts`, beside the runtime's `layer`, empty until two domains exist to connect. A subscription picks its events with the event's own schema (`Schema.is`), so a subscriber never sees a value its schema refuses.

### DEC-12 `waitUntil` comes from the request Nitro hands over, and publishing hands it only the work of the subscriptions that heard the event

HEX-17, [#14](https://github.com/Diplow/diplow/pull/14). Nitro's Vercel entry puts Vercel's `waitUntil` on the request (srvx's `ServerRequest`), and srvx does the same under `pnpm dev`, so the middleware reads it off Start's `getRequest()`: no `@vercel/functions`, which would be one more SDK to put behind a repository. Where a request has none, the work still runs and nothing keeps the function up. Each subscription reads the PubSub in a fiber scoped to the runtime, not to the request, so the request ending does not interrupt it. Publishing creates one `Deferred` per subscription that accepts the event and hands `WaitUntil`, which `run` provides per request, the effect that awaits them. `run` turns it into the promise `waitUntil` takes, so `run.ts` stays the only file that runs a program. Seen on `effect@4.0.0-rc.117` while testing it: a forked fiber running `Effect.andThen(Deferred.await(d), () => value)` never reaches what follows it, while `Effect.map` does. The bus and its tests use `map` and `flatMap`.

### DEC-13 Until HEX-19, "logged at medium" is a log line annotated `verbosity: medium`, carrying the message's tag only

HEX-17, [#14](https://github.com/Diplow/diplow/pull/14). The levels do not exist before HEX-19, and they cannot be Effect's log levels: STACK.md puts information logs at `low`, below the bus's `medium`. So each bus logs one line per message, annotated `{ bus: 'server' | 'client', verbosity: 'medium' }`, through Effect's logger on the server and `console.debug` in the client. HEX-19 filters on the annotation. The line carries the `_tag` and never the fields, which will hold account data once IAM publishes.

### DEC-14 The client bus is `src/features/bus.ts`; a feature reacts with `useFact` over `useSyncExternalStore`, and shared facts go in `src/features/facts.ts`

HEX-17, [#14](https://github.com/Diplow/diplow/pull/14). A fact's listener may not import the feature that publishes it, so the bus and the facts it carries sit beside the feature folders, where `no-feature-importing-another` does not reach (its pattern only matches folders), as `kind.ts` does for domains. `useEffect` is banned outside `ui/`, so `useFact` subscribes through `useSyncExternalStore`, React's hook for a source outside React, with a snapshot that never changes, so it never re-renders. The listeners are module-level: only mounted components subscribe, and `useSyncExternalStore` never subscribes during a server render, so a request never leaks into another. No fact exists yet: `facts.ts` arrives with the first one, since naming it is a domain's call.

### DEC-15 The one boundary a message is decoded at today is `receive`, on the client

HEX-17, [#14](https://github.com/Diplow/diplow/pull/14). STACK.md decodes a message where it crosses a boundary (into the client, into an outbox), and types it inside one process. The server bus is in-process and no event leaves the server yet, so it decodes nothing and routes by schema. The client bus has `receive(schema, input)`, which decodes a fact coming from outside the page before any feature sees it, and drops and reports one that does not decode. The outbox decodes when it exists.

### DEC-16 Better Auth reaches Postgres through Drizzle's promise API over node-postgres, beside the Effect `Database`

HEX-18, [#15](https://github.com/Diplow/diplow/pull/15). Better Auth's Drizzle adapter awaits its queries, and Drizzle's Effect driver yields them, so the adapter cannot take `Database`. The database repository adds `PromiseDatabase`: `drizzle-orm/node-postgres` over a `pg` pool on the same `DATABASE_URL`, and `drizzle-orm/pglite` over the same PGlite as `Database` in tests. Writing a Better Auth adapter over `Database` would have meant running Effect programs outside the helper, and Kysely, Better Auth's other way in, would have put IAM's tables outside drizzle-kit's migrations. `pg` 8 is stable; it and PGlite join the database's SDK list in `dependency-cruiser.config.ts`. `better-auth` is `^1.7.6`, its `minimal` build, without Kysely.

### DEC-17 IAM's tables keep Better Auth's names

HEX-18, [#15](https://github.com/Diplow/diplow/pull/15). Better Auth's `user` table is IAM's Account, and its `account` table is a way to sign in, which clashes with IAM's word. Renaming both through Better Auth's `modelName` and field options would have made every Better Auth document and plugin (Stripe's first) need translating. So `schema.ts` holds the tables as Better Auth's generator writes them, and the words stop at the repository: IAM, and everything above it, sees only `Account` and `Session`. `repositories/auth/CLAUDE.md` says which is which.

### DEC-18 Better Auth is called from server functions only, never through a route of its own

HEX-18, [#15](https://github.com/Diplow/diplow/pull/15). The security bar allows a raw server route only for an inbound webhook, and puts every call behind Start's middleware and a schema. So sign-up, sign-in and sign-out are server functions, and the `Set-Cookie` lines Better Auth returns go on Start's response through `HttpExchange`, which the helper provides per request, so the tests carry cookies with a plain jar. Better Auth's rate limiter runs only in its request handler, so signing up and in are posted to `auth.handler` in-process, a `Request` built from the client's headers (DEC-24); the session and sign-out use `auth.api.*` with `returnHeaders: true`. The callback routes an OAuth provider needs come with the first one.

### DEC-19 The middleware resolves the Session for every server function; a guarded page checks it in `beforeLoad`

HEX-18, [#15](https://github.com/Diplow/diplow/pull/15). The security bar wants auth checked in middleware. `middleware.ts` asks IAM for the Session a request's cookie proves (`provenSession` in `run.ts`, the one other program it runs) and puts it on Start's context, and `run` provides it as `CurrentSession`; without a session cookie Better Auth answers without a query. A server function for signed-in Accounts starts with `Iam.signedIn`, which fails `SignedOut`, of kind Unauthenticated. A page does the same before it renders: `beforeLoad: signedIn` calls the `session` server function and turns Unauthenticated into a router redirect to `/sign-in?redirect=…`, on the server too, where the client's channel has no window to move. `/dev/session` is the one guarded page until Mapping's.

### DEC-20 Sign-up asks an email and a password only; the Account's name stays empty until Mapping

HEX-18, [#15](https://github.com/Diplow/diplow/pull/15). STACK.md says an Account's name is the Root tile's Title, copied into Better Auth, never the other way. So sign-up asks no name, and Better Auth's `name` is an empty string until Mapping copies the Root's Title there. Email and password is the only way in: another (a social provider, a magic link) is a product decision, and the first to need a callback brings `BETTER_AUTH_URL`.

### DEC-21 IAM's refusals are Invalid errors on the field at fault, and sign-in does not say which of the two was wrong

HEX-18, [#15](https://github.com/Diplow/diplow/pull/15). `CredentialsRejected` (on the password), `EmailTaken`, `EmailMalformed` and `PasswordLengthInvalid` are of kind Invalid, so a form's submit shows each under its field, worded by the message table in both languages. An unknown email and a wrong password are the same `CredentialsRejected`. `EmailTaken` does tell sign-up that an email has an Account, as most sign-up forms do; hiding it needs email verification first. The server functions' schemas only bound the strings (320 and 1024 characters): what an email or a password must be is IAM's to say on the field, where a schema failure would reach the client as Unexpected.

### DEC-22 Without `DATABASE_URL`, `pnpm dev` and the tests run on an in-memory PGlite

HEX-18, [#15](https://github.com/Diplow/diplow/pull/15). With `Auth` in the runtime, every server function needs a database, and no Neon database exists yet (`HEX-16#PARK-1`). `run.ts` picks the repositories once: deployed, Better Auth over `DATABASE_URL` with `BETTER_AUTH_SECRET`; under `import.meta.env.DEV` without `DATABASE_URL`, `TestAuth`, over a fresh, migrated PGlite with a random secret. `run.test.ts` and the `/dev` pages keep working with nothing to set up, and a build never holds that branch (the import is dynamic, behind `import.meta.env.DEV`). Accounts made under `pnpm dev` are gone on restart; setting `DATABASE_URL` points it at a real Postgres.

### DEC-23 A module the client imports keeps `run.ts` inside its handlers, and server function calls from another site are refused

HEX-18, [#15](https://github.com/Diplow/diplow/pull/15). Start strips what a handler alone uses, not what a module exports. `api/dev/provoke.ts` exported the Effect programs its tests use, which reference `run.ts`, so `/dev/errors`' client bundle held the whole runtime, Better Auth and Drizzle once IAM joined it (877 kB). The programs moved to `api/dev/programs.ts`, and `outcomes` to `failures.ts`. No lint sees what Start's compiler strips, so `build` now ends with `scripts/check-client-bundle.ts`, which fails when the client bundle holds the runtime, Better Auth, Drizzle or their secret's name; the phase gate and every Vercel preview run it. With a session cookie on every call, `src/start.ts` now runs Start's `createCsrfMiddleware` on server function requests, which Start warned about in dev: a call whose `Sec-Fetch-Site` or `Origin` is another site gets a 403 before any middleware of ours.

### DEC-24 Signing up and in are rate limited per IP by Better Auth, counted in the database

HEX-18, [#15](https://github.com/Diplow/diplow/pull/15). cubic's first review found nothing limited credential attempts, since Better Auth's limiter does not run on `auth.api` calls. Its defaults allow 3 sign-ups or sign-ins per IP in 10 seconds; with `storage: 'database'` the count lives in a `rate_limit` table, so Vercel's instances count together, where the memory store would count per instance. The IP is `x-forwarded-for`, which Vercel overwrites with the client's. A refused attempt is IAM's `TooManyAttempts`, of kind Forbidden, so a form's submit shows it as a toast. Sign-up and sign-in count in separate buckets, so this slows the one enumeration sign-up allows (DEC-21) rather than preventing it: that takes email verification, and a provider to send it (`HEX-18#PARK-1`).

### DEC-25 One observability seam: plain functions for the browser, Effect services for the server's runtime

HEX-19, [#16](https://github.com/Diplow/diplow/pull/16). Sentry's TanStack Start SDK (a beta), `posthog-js` and `posthog-node` are imported by `src/repositories/observability/` only, like any SDK. The browser's side is plain functions, since the client is not Effect; the server's is two services, `Analytics` and `ErrorTracker`, so the tests swap them for recorders. Sentry starts in `src/server.ts`, the server entry, which `wrapFetchWithSentry` also traces; it is not preloaded with `node --import`, which Vercel's Nitro output does not offer, so Node's automatic instrumentation (outgoing HTTP, `pg`) is partial: errors and request traces are there. Sentry's Vite plugin, which uploads source maps, is not wired: it needs `SENTRY_AUTH_TOKEN`, a secret, and the Sentry org and project, none of which exist yet.

### DEC-26 A log line names its topic, not its level; the levels map topics, and replace DEC-13's annotation

HEX-19, [#16](https://github.com/Diplow/diplow/pull/16). `observability/levels.ts` gives each topic of STACK.md's table (`page`, `action`, `call`, `error`, `domain`, `state`, `bus`, `info`, `repository`, `render`) the least verbose level that logs it, so a caller never picks a level and moving a topic is one line. On the server a line names its topic with an annotation, `topic: 'bus'`, which replaces DEC-13's `verbosity: 'medium'`; a line without one is `info`, or `error` at the error level. The logger added beside Effect's own sends what the request's level logs to PostHog, as an event named by the topic, carrying identifiers only (request id, scope, kind, code, bus).

### DEC-27 An error is reported where it is first seen: the server for every failure it sends, the client for what never reached it

HEX-19, [#16](https://github.com/Diplow/diplow/pull/16). `run` logs a declared failure as PostHog's `error` event alone, since it is an answer, not a bug, and anything that becomes `Unexpected` with its cause, so Sentry captures it and PostHog's event carries Sentry's event id. Any error line with a cause does the same, a bus subscriber's failure included. The client reports only a call without a request id (it never reached the helper) and a feature that threw, through `reportError`: Sentry, then the `error` event. So a frame read's failure, the channel table's "reported", is the server's report, and the client no longer logs it again. `run` builds its outcome inside the one program, so a failure of the logging itself cannot keep an `Outcome` from coming back; only the runtime failing to build gets past it, and `unobserved` sends that to Sentry directly.

### DEC-28 The DSN, PostHog's key and its host are public `VITE_` variables, read at build time by both sides; Sentry gets no user data

HEX-19, [#16](https://github.com/Diplow/diplow/pull/16). Sentry's DSN and PostHog's project key are meant for browsers, so one `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` serve both sides, and a side without them starts nothing. The host has no default: the region is the PostHog project's, chosen when it is created. Sentry's v11 `dataCollection` is turned off entirely (cookies, the session's among them, headers, bodies, query parameters, local variables, database parameters), and every event goes through `beforeSend`, which drops the request's query and redacts email addresses and token-like runs from messages and exception values: cubic's first review showed a defect's message can quote a row a user sent. Source context lines stay, since they are the app's own code. PostHog's autocapture masks every element's text and attributes. `tracesSampleRate` is 1 in previews and development, 0.2 in production. No Sentry project, PostHog project or `verbosity` flag exists yet: creating them is a human's (`HEX-19#PARK-1` holds the rest of what is left).

### DEC-29 The `verbosity` flag raises one Account's level on both sides; the environment is fixed at build time

HEX-19, [#16](https://github.com/Diplow/diplow/pull/16). `__ENVIRONMENT__`, set in `vite.config.ts` from `VERCEL_ENV`, is `development` under `pnpm dev`, `preview` on a Vercel preview and `production` otherwise, a local build included. A multivariate flag keyed `verbosity` can only raise that level. The server reads it for the signed-in Account in `requestLog`, before the program, and keeps each value five minutes, with PostHog's request capped at 500 ms, so a flag costs at most one such wait per Account every five minutes; a flag it cannot read leaves the environment's level. The browser ties the device to the Account id on signing in or up (`continueTo`) and on every guarded page, and PostHog keeps that across page loads; a guarded visit that finds nobody signed in unties it. The browser applies the flag only while the device is tied to an Account, so an anonymous visitor or a device just signed out never keeps someone's raised level.

### DEC-30 PostHog captures page visits and action clicks itself; the other topics have no call site yet

HEX-19, [#16](https://github.com/Diplow/diplow/pull/16). Both log at every level, so `capture_pageview: 'history_change'` and autocapture do it with no code of ours. Server function calls, errors and bus messages are logged. Domain service calls, state actions, repository calls, renders and shortcuts have no call site yet: no domain logs its calls, no state hook dispatches through a shared place, and TanStack Hotkeys has not arrived. Each logs with its `topic` as it is built (api's CLAUDE.md, "Observability").

