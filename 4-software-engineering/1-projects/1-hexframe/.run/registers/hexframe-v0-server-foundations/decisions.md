---
title: decisions, hexframe v0 Server foundations
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-v0-server-foundations
owner: diplo
preview: >-
  The choices the autonomous run made while building hexframe v0's server
  foundations, where a ticket left room: Effect 4 with Drizzle v1's own
  Effect driver, where the error kinds live, what a server function returns,
  how the client carries each channel out, and how migrations run.
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

HEX-16, [#13](https://github.com/Diplow/diplow/pull/13). The `ManagedRuntime` in `src/api/server/run.ts` builds every layer on its first call. With `Database` in it today, `/dev/errors`, `run.test.ts` and every server function would need `DATABASE_URL` and a live Postgres before any of them reads a row. HEX-18 adds it to `layer` along with IAM, and has to pick how a server function's integration test gets `TestDatabase` in its place.

### DEC-10 One migrator everywhere: Drizzle's Effect migrator, run by `scripts/migrate.ts`

HEX-16, [#13](https://github.com/Diplow/diplow/pull/13). `drizzle-kit migrate` would need a second Postgres driver (`pg`) and would apply migrations with other code than the tests use. `pnpm db:migrate` runs `node scripts/migrate.ts`, which applies them with `drizzle-orm/effect-postgres/migrator` over the same `Database` layer the app uses. The PGlite harness runs the same `migrated` program over its own `Database`. To run without a bundler, the script and `migrations.ts` import with `.ts` paths (`allowImportingTsExtensions`), and `database.ts` imports packages only.
