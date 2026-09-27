---
title: auth
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/auth
owner: diplo
preview: >-
  The auth repository: Better Auth over the database, as one Auth service in
  Better Auth's own terms (a user, a session), called through its server API
  from server functions only, its cookies carried by HttpExchange. IAM, above,
  speaks of Accounts and Sessions.
---
# auth

Better Auth, behind one Effect service, `Auth`: sign up, sign in, sign out, and the session a request's cookie proves. It speaks Better Auth's words (a user, a session) and knows nothing of IAM's; [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE|iam]] turns them into Accounts and Sessions. Only this folder imports `better-auth`, `@better-auth/*` and Stripe (`dependency-cruiser.config.ts`).

| File | Holds |
|---|---|
| `auth.ts` | `Auth` and `layer`, the deployed one, signing its cookies with `BETTER_AUTH_SECRET`; `make`, the service for a given secret; `HttpExchange`, the request a call belongs to; `AuthRefused`, the refusals a user can fix |
| `testing.ts` | `TestAuth`, Better Auth for real over `TestDatabase`, with a secret made for the run; and `browser()`, a cookie jar that carries what one call sets to the next |

## How it talks to Better Auth

- **Through its server API, never its HTTP handler.** Every call comes from a server function, through the helper: `auth.api.signInEmail({ body, headers, returnHeaders: true })`. So no raw `/api/auth/*` route exists, and no request reaches Better Auth that did not go through Start's middleware, the CSRF check included. The first OAuth provider will need a callback route, and with it `BETTER_AUTH_URL`.
- **Cookies travel through `HttpExchange`.** It holds the request's headers, which Better Auth reads the session cookie from, and `setCookies`, where the `Set-Cookie` lines it returns go. The API layer's middleware provides it from Start's request and response; `browser()` provides it in tests.
- **Over the same Postgres, through Drizzle's promise API.** Better Auth's Drizzle adapter awaits its queries, so it gets `PromiseDatabase` from [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/database/CLAUDE|database]], not the Effect `Database`. Its tables are in `database/schema.ts` under Better Auth's names, and reach the database through committed migrations like any other.
- **Better Auth's names are not IAM's.** Its `user` table is IAM's Account; its `account` table is one way an Account signs in (here, the password hash). IAM never sees either word.
- **The user's name is left empty.** Better Auth wants one; IAM leaves it to Mapping, which copies the Root's Title there.

## Rules

- **A refusal a user can fix is `AuthRefused`, with its reason; anything else is a defect.** Better Auth's error codes are mapped in `auth.ts`, and a malformed email, which fails Better Auth's input schema rather than a check of its own, is recognised by the field its message names. `iam.test.ts` pins each one, so an upgrade that renames them fails a test.
- **No token leaves this folder.** A session answers its user and its expiry; the token stays in its cookie.
- **Rate limiting is Better Auth's HTTP handler's, which is not used.** Nothing limits sign-in attempts yet; that belongs to the edge (Vercel's firewall) or a later ticket.

## Environment

| Variable | Where | What |
|---|---|---|
| `BETTER_AUTH_SECRET` | every deployed environment | Signs the session cookies: 32 random bytes or more, one per environment. The layer fails to build without it |
| `DATABASE_URL` | every deployed environment | The Postgres Better Auth reads and writes, through `PromiseDatabase` |

Under `pnpm dev` and the tests, without `DATABASE_URL`, `src/api/server/run.ts` uses `TestAuth` instead: Better Auth over a fresh PGlite in memory, with a secret of its own, both gone when the process stops.
