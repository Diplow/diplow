---
title: observability
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/observability
owner: diplo
preview: >-
  The observability seam: Sentry's TanStack Start SDK, a beta, and PostHog's
  browser and Node SDKs, imported here only. Sentry gets errors and traces,
  PostHog the leveled event log and the verbosity flag. Both stay off without
  their public keys, and neither ever gets a cookie, a header or a payload.
---
# observability

The seam behind which hexframe is observed: Sentry for errors and traces, PostHog for the leveled event log and the feature flag that raises one user's verbosity. Only this folder imports `@sentry/*`, `posthog-js` and `posthog-node` (`dependency-cruiser.config.ts`, `sdks`). What gets logged, and when, is the API layer's: [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/observability/CLAUDE|api's observability]].

| File | Side | Holds |
|---|---|---|
| `sentry.ts` | both | `startSentry`, which keeps every trace in development and previews, a fifth of them in production; `captureError`, which returns the id of the event it made; and the scrubbing every event and breadcrumb goes through before it leaves (`scrubbed`, `scrubbedBreadcrumb`, `redacted`). The one package serves both sides: the bundler picks its browser build for the client, its Node build for the server. Tested |
| `sentry-server.ts` | server | `traced`, the server entry with each request a trace, as `startSentry` samples them; `ErrorTracker`, Sentry as the runtime sees it, and `errorTracker`, its layer |
| `posthog-server.ts` | server | `Analytics`: `capture` an event, read a `flag` for one person (kept five minutes, PostHog given 500 ms to answer; a failed read is not kept, and an answer without the flag, as a timeout comes back, 30 seconds), `flush` the queue; `analytics`, its layer, a no-op while PostHog is off. Tested against a stand-in for PostHog's client |
| `posthog-browser.ts` | client | `startBrowserAnalytics`, with page visits and action clicks captured by PostHog itself; `captureInBrowser`; `accountFlagInBrowser`, a flag's value while the device is tied to an Account, as PostHog keeps it (`$user_state`, read through the public `get_property`); `identifyInBrowser` and `forgetInBrowser`, which tie it and untie it. Tested through its caller, `api/observability/client.test.ts`, this folder holding six files already |

## Rules

- **Sentry's TanStack Start SDK is a beta**, allowed because this folder is its seam (STACK.md, "Runtime and versions"): swapping it touches these files and nothing above. Its Vite plugin, which uploads source maps with an auth token, is not wired.
- **Sentry gets the error, not what the user sent.** `startSentry` turns off every kind of data collection: cookies, the session's among them, headers, bodies, query parameters, local variables, database parameters. What is left goes through `scrubbed` before it leaves: a request keeps its method and its URL without query, no user is attached, and every message and exception value keeps its shape but not its values, since a defect's message can quote what a user sent. `redacted` replaces what the message quotes (in quotes, or in parentheses after `=` as Postgres quotes a row), a value a secret key names, on its own or as the last word of a longer one (`password=…`, `client_secret=…`, `apiKey=…`), and a one-time code's (`code=…`, `verificationCode=…`, `auth_code=…`), never a status or an exit code's, email addresses, runs of six digits or more, and token-like runs. Every text in an event's extra data, its log entry and its contexts but the trace's ids is redacted too: the SDK puts there a thrown value that is not an Error. A transaction's name, its spans and its trace lose every URL's query and fragment the same way, since fetch and HTTP instrumentation name a span by its full URL. Console breadcrumbs are dropped; any other loses its URLs' queries, its query and fragment fields, and every other text in its data is redacted. An error is traced by the tags it is captured with: the request id, the scope, the kind.
- **PostHog gets names and identifiers, never a payload.** An event carries a topic, a message written in the code, a request id, a scope, a kind, a code, a Sentry event id. Autocapture masks every element's text and attributes, so a click never carries what a user wrote. A signed-out request's events are the request's, with no person profile.
- **Off without its keys.** A side that has no DSN, or no project key and host, starts nothing and sends nothing; `pnpm dev` and the tests run that way.
- **A server-only file is never imported by the client.** `sentry-server.ts` needs the SDK's Node build, and `posthog-server.ts` holds a Node client; `scripts/check-client-bundle.ts` fails the build when `Analytics` or `ErrorTracker` reaches the client bundle.

## Environment

All three are public by design (Sentry's DSN and PostHog's project key are meant for browsers) and read at build time, by both sides: set them in Vercel for every environment, then redeploy.

| Variable | What |
|---|---|
| `VITE_SENTRY_DSN` | The Sentry project's DSN. Sentry is off without it |
| `VITE_POSTHOG_KEY` | The PostHog project's key (`phc_…`). PostHog is off without it and the host |
| `VITE_POSTHOG_HOST` | The PostHog ingestion host of the project's region: `https://eu.i.posthog.com` or `https://us.i.posthog.com` |

The per-user override is a multivariate PostHog feature flag keyed `verbosity`, with the variants `high`, `medium` and `low`, served to the Accounts to raise.
