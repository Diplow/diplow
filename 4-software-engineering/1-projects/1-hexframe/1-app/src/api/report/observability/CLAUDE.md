---
title: observability
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/observability
owner: diplo
preview: >-
  What hexframe logs and where its errors go: every line has a topic, every
  topic a verbosity level, each environment a level, raised for one Account by
  a PostHog flag. Errors reach Sentry first, then PostHog as a small error
  event pointing to Sentry's. The server's logger, and the client's log and
  report.
---
# observability

The API layer's side of observability: what is logged, at which verbosity, and where an error is reported. Sentry owns errors, traces and alerting; PostHog, product analytics and the leveled event log. Both SDKs sit behind [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/observability/CLAUDE|their seam]], which this folder alone calls.

| File | Side | Holds |
|---|---|---|
| `levels.ts` | both, pure | The topics and their levels, `logs`, `verbosityFor` (the environment's level raised by a flag) and `environmentOf`, which `vite.config.ts` sets `__ENVIRONMENT__` with |
| `server.ts` | server | The logger `run.ts`'s runtime adds beside Effect's own, `requestLog` (a request's verbosity and who its lines are about), what `run` does around a program: log its call (`called`) and the failure it sends (`sent`, `failedUnexpectedly`), flush PostHog's queue (`flushed`), report a failure of the runtime no logger heard (`unobserved`), and `observedEntry`, the server entry with Sentry started and each request traced |
| `client.ts` | client | `startObservability`, run once by the router; `log` and `reportError`; `identify` and `forget`. Tested against a stand-in for PostHog's browser SDK, which also pins when `posthog-browser.ts` ties, unties and reads a flag |

## Levels

Each line has a topic, and each topic a level. A level logs its own topics and those of every level above it:

| Level | Logs | Where by default |
|---|---|---|
| high | page visits (`page`), action clicks and shortcuts (`action`), server function calls (`call`), errors (`error`) | production |
| medium | high, plus domain service calls (`domain`), state actions (`state`), bus messages (`bus`) | previews |
| low | medium, plus information (`info`), repository and database calls (`repository`), renders (`render`, in development only) | development |

- **The environment is fixed at build time**: `development` under `pnpm dev`, `preview` on a Vercel preview, `production` for any other build, a local one included.
- **A PostHog feature flag raises one Account's level, never lowers it.** The flag is `verbosity` (`high`, `medium`, `low`). The server reads it for the signed-in Account in `requestLog`, whether its Session or its Key proves it, before the program, and keeps each value it reads five minutes; a flag it cannot read leaves the environment's level, and is read again shortly. The browser applies it only while the device is tied to an Account: `identify` ties it on signing in or up (`continueTo`) and on every page `signedInOnly` guards, `forget` unties it when a guarded visit, or a call made in the page (`client/channels.ts`), finds nobody signed in.

## Rules

- **On the server, every layer logs through Effect's logger** and names its line's topic with an annotation: `Effect.log('…').pipe(Effect.annotateLogs({ topic: 'domain' }))`. A line without one is `info`, or `error` at the error level. Effect's own logger still prints every line to the server's log; the logger in `server.ts` sends those the request's level logs to PostHog, as an event named by the topic.
- **An error goes to Sentry first, then PostHog points to it.** An error line carrying a cause (`Effect.logError('…', cause)`) is captured by Sentry, and its PostHog `error` event carries Sentry's event id beside what is known of the error: its kind and code (the failure's tag) and, inside a request, its scope and request id. Never a second copy of the stack.
- **`run` logs every call and every failure it sends.** The call at `call`, before the program, even when the request's Session could not be resolved; a declared failure as PostHog's `error` event alone, since it is an answer, not a bug; anything that becomes `Unexpected` with its cause, so Sentry has it. A failure of the runtime itself, which no logger hears, goes to Sentry and the console through `unobserved`. Once the work the program left to `waitUntil` has settled, PostHog's queue is flushed through `waitUntil` too.
- **In the browser, PostHog captures page visits and action clicks itself**, with every element's text and attributes masked. The client logs its other topics with `log(topic, message)`, to the console while PostHog is off. An error the server never saw (a call that never reached it, a feature that threw) goes through `reportError`: Sentry, then PostHog's `error` event carrying Sentry's id. A failure the server sent is not reported again: the server logged it, with the request id the client shows.
- **What an event carries is named, never a payload**: the topic, a message written in the code, and identifiers (a request id, a scope, a kind, a code, the bus, Sentry's event id). No field of a fact, an event or a form.
