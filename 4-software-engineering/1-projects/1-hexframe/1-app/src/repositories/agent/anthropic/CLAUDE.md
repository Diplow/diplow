---
title: anthropic
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/agent/anthropic
owner: diplo
preview: >-
  The model relay: a Turn's model call made to Anthropic with plain fetch and
  no SDK, the platform's key added, its answer relayed chunk by chunk as it
  comes, what it used read from the stream on the way. It knows no limit:
  Assistant decides first. A fake in this process for every test and pnpm dev
  without ANTHROPIC_API_KEY.
---
# anthropic

Where a Turn's agent reaches the model. The agent, Claude Code in its sandbox, calls the app's proxy ([[4-software-engineering/1-projects/1-hexframe/1-app/src/api/server/proxy/CLAUDE|proxy]]), and once [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/CLAUDE|Assistant]] has said the Turn may spend, this repository makes the call. It speaks Anthropic's wire format: endpoints, headers, server-sent events, usage fields. Which models, fields and betas a call may hold, and what a token costs, are Assistant's.

| File | Holds |
|---|---|
| `anthropic.ts` | The `Anthropic` service, `relay(call)`: a `ModelCall` (its endpoint, `messages` or `count_tokens`, `anthropic-version` and `anthropic-beta` as they came, its body) sent to `https://api.anthropic.com` with the platform's key as `x-api-key` and nothing of the agent's request; answered as `Relayed`, its status, the headers worth passing back (`content-type`, `request-id`, `retry-after`), its body as it comes, and its `usage` once the body has ended. `makeAnthropic` over any upstream; `layer`, over `fetch`, its key from `ANTHROPIC_API_KEY`; `hasKey`, which `src/api/server/run.ts` picks the layer by |
| `usage.ts` | `metered`, an answer's body relayed one chunk upstream for each the reader asks for, nothing buffered, read on the way: a stream's `message_start` and `message_delta` events, the delta's counts cumulative, or a plain answer's `usage`; settled when the body ends, fails or is cancelled, a Stop's cancel reaching upstream. `Usage`, the tokens by how they are priced, input, output, cache writes for five minutes and for an hour, cache reads |
| `fake.ts` | The fake Anthropic: `layer`, the relay over an upstream in this process with a key that reaches nothing; `fakeAnthropic`, the calls it was made and the handler a test answers them by, a short streamed message by default; `eventStream` and `streamedMessage`, an answer shaped as Anthropic streams one |
| `anthropic.test.ts` | The relay over an upstream of the test's own: the call's URL, the platform's key in place of any of the agent's headers, the version and betas passed; a stream relayed chunk by chunk, the next one not there before upstream sends it; usage from a stream split mid-line and from a plain answer, a cache write without its split read as a five-minute one; what was used kept when the reader goes away, upstream cancelled; no usage for an answer that failed; a defect without the key, nothing called |

## Rules

- **Plain `fetch`, no SDK.** A relay passes a body on; it needs no client that would retry, rebuild or validate it. So no line in `dependency-cruiser.config.ts`'s `sdks`.
- **The platform's key stays here.** It is read from `ANTHROPIC_API_KEY`, server-only, put on the call as `x-api-key`, and goes nowhere else: not on the answer, not in a log, never into a sandbox. The agent's `Authorization`, its Turn's Key, is never passed on.
- **It knows no limit.** Assistant decides whether a call may go before it asks, and prices what the call used; this folder neither caps nor counts.
- **Nothing waits on the way.** The answer is pulled from upstream one chunk at a time as the agent reads it, pings included, so a stream reaches Claude Code as Anthropic sends it.
- **A failure below is a defect.** Anthropic unreachable, or no key: the caller sees no typed error. An answer Anthropic sent, an error's included, is relayed as it came.
- **No test and no gate reaches Anthropic.** `src/api/server/run.ts` takes the fake under `pnpm dev` without `ANTHROPIC_API_KEY` and in every test, where `vitest.config.ts` empties it whatever the shell exports; a build never holds that branch.

## Environment

| Variable | Where | What |
|---|---|---|
| `ANTHROPIC_API_KEY` | every deployed environment that runs Turns; locally in `.env.local`, never committed, to try Anthropic by hand | The platform's key. Without it, `pnpm dev` runs on the fake, and a deployment's model calls are defects |
