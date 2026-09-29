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

The seam behind which hexframe is observed: Sentry for errors and traces, PostHog for the leveled event log and the feature flag that raises one user's verbosity. Only this folder imports `@sentry/*`, `posthog-js` and `posthog-node` (`dependency-cruiser.config.ts`, `sdks`). What gets logged, and when, is the API layer's: [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]], "Observability".

| File | Side | Holds |
|---|---|---|
| `sentry.ts` | both | `startSentry` and `captureError`, which returns the id of the event it made. The one package serves both sides: the bundler picks its browser build for the client, its Node build for the server |
| `sentry-server.ts` | server | `traced`, the server entry with every request a trace; `ErrorTracker`, Sentry as the runtime sees it, and `errorTracker`, its layer |
| `posthog-server.ts` | server | `Analytics`: `capture` an event, read a `flag` for one person (kept five minutes), `flush` the queue; `analytics`, its layer, a no-op while PostHog is off |
| `posthog-browser.ts` | client | `startBrowserAnalytics`, with page visits and action clicks captured by PostHog itself; `captureInBrowser`; `identifyInBrowser` and `forgetInBrowser`, which tie this device to an Account and untie it |

## Rules

- **Sentry's TanStack Start SDK is a beta**, allowed because this folder is its seam (STACK.md, "Runtime and versions"): swapping it touches these files and nothing above. Its Vite plugin, which uploads source maps with an auth token, is not wired.
- **Nothing the user sent reaches Sentry.** `startSentry` turns off every kind of data collection: cookies, the session's among them, headers, bodies, query parameters, local variables, database parameters. An error is traced by the tags it is captured with: the request id, the scope, the kind.
- **PostHog gets identifiers, never a payload.** An event carries a topic, a message, a request id, a scope, a kind, a tag, a Sentry event id. A signed-out request's events are the request's, with no person profile.
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
