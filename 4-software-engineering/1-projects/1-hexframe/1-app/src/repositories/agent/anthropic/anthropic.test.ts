import { describe, expect, it } from '@effect/vitest'
import { Effect, Exit, Redacted } from 'effect'

import { makeAnthropic, type ModelCall, type Upstream } from './anthropic'
import { eventStream, streamedMessage } from './fake'

// The relay over an upstream of the test's own, never Anthropic: what it sends, what it relays back
// and when, and what it reads of the call's usage on the way.

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const call: ModelCall = {
  endpoint: 'messages',
  version: '2023-06-01',
  betas: 'claude-code-20250219,interleaved-thinking-2025-05-14',
  body: { model: 'claude-sonnet-5-5', max_tokens: 1024, messages: [] },
}

/** A relay whose upstream answers `answer`, keeping the requests it was made. */
function relayOver(answer: (request: Request) => Response, apiKey = 'sk-test') {
  const made: Array<Request> = []
  const upstream: Upstream = (request) => {
    made.push(request)
    return Promise.resolve(answer(request))
  }
  const { relay } = makeAnthropic({
    apiKey: Redacted.make(apiKey),
    upstream,
    origin: 'https://anthropic.test',
  })
  return { made, relay }
}

/** A stream the test feeds by hand, one chunk at a time, which knows whether it was cancelled. */
function handFed() {
  let feed: ReadableStreamDefaultController<Uint8Array> | undefined
  const state = { cancelled: false }
  const stream = new ReadableStream<Uint8Array>({
    start: (controller) => {
      feed = controller
    },
    cancel: () => {
      state.cancelled = true
    },
  })
  return {
    stream,
    state,
    send: (text: string) => feed?.enqueue(encoder.encode(text)),
    close: () => feed?.close(),
  }
}

const streamed = (body: ReadableStream<Uint8Array>, headers: Record<string, string> = {}) =>
  new Response(body, { headers: { 'content-type': 'text/event-stream', ...headers } })

/** The next chunk a reader gets, as text. */
const next = (reader: ReadableStreamDefaultReader<Uint8Array>) =>
  Effect.promise(async () => decoder.decode((await reader.read()).value))

/** Whether a read already settled, 20 ms after it was asked for. */
const settledSoon = (read: Promise<unknown>) =>
  Effect.promise(() =>
    Promise.race([
      read.then(() => true),
      new Promise<false>((resolve) => setTimeout(resolve, 20, false)),
    ]),
  )

const text = (body: ReadableStream<Uint8Array> | null) =>
  Effect.promise(() => new Response(body).text())

describe('the model relay', () => {
  it.effect(
    "sends the call with the platform's key and Anthropic's headers, nothing of the agent's",
    () =>
      Effect.gen(function* () {
        const { made, relay } = relayOver(() =>
          streamedMessage('hi', { input_tokens: 1, output_tokens: 1 }),
        )
        yield* relay(call)
        const [request] = made
        expect(request?.url).toBe('https://anthropic.test/v1/messages')
        expect(request?.method).toBe('POST')
        expect(request?.headers.get('x-api-key')).toBe('sk-test')
        expect(request?.headers.get('anthropic-version')).toBe('2023-06-01')
        expect(request?.headers.get('anthropic-beta')).toBe(call.betas)
        expect(request?.headers.get('authorization')).toBeNull()
        expect(yield* Effect.promise(async (): Promise<unknown> => request?.json())).toEqual(
          call.body,
        )

        yield* relay({ ...call, endpoint: 'count_tokens', betas: undefined })
        expect(made[1]?.url).toBe('https://anthropic.test/v1/messages/count_tokens')
        expect(made[1]?.headers.has('anthropic-beta')).toBe(false)
      }),
  )

  it.effect(
    'relays the stream chunk by chunk, as it comes, with the headers worth passing back',
    () =>
      Effect.gen(function* () {
        const fed = handFed()
        const { relay } = relayOver(() =>
          streamed(fed.stream, { 'request-id': 'req_1', 'set-cookie': 'a=b' }),
        )
        const relayed = yield* relay(call)
        expect(relayed.status).toBe(200)
        expect(relayed.headers.get('request-id')).toBe('req_1')
        expect(relayed.headers.get('set-cookie')).toBeNull()

        const reader = relayed.body?.getReader()
        if (reader === undefined) throw new Error('No body was relayed')
        fed.send('event: ping\ndata: {"type":"ping"}\n\n')
        expect(yield* next(reader)).toContain('ping')
        // The next chunk is not there before upstream sends it, and is as soon as it does.
        const later = reader.read()
        expect(yield* settledSoon(later)).toBe(false)
        fed.send('event: message_stop\ndata: {"type":"message_stop"}\n\n')
        const { value } = yield* Effect.promise(() => later)
        expect(decoder.decode(value)).toContain('message_stop')
        fed.close()
      }),
  )
})

describe('what a relayed call used', () => {
  it.effect(
    'reads what a streamed call used from its start and its last delta, cache writes and reads apart',
    () =>
      Effect.gen(function* () {
        const events = eventStream([
          {
            type: 'message_start',
            message: {
              usage: {
                input_tokens: 12,
                output_tokens: 1,
                cache_creation_input_tokens: 300,
                cache_read_input_tokens: 4000,
                cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 },
              },
            },
          },
          { type: 'ping' },
          // A delta that says `null` for a count keeps the one said before.
          {
            type: 'message_delta',
            usage: { output_tokens: 42, input_tokens: null, cache_creation: null },
          },
          { type: 'message_stop' },
        ])
        const fed = handFed()
        const { relay } = relayOver(() => streamed(fed.stream))
        const relayed = yield* relay(call)
        // Split mid-line, as a network may.
        fed.send(events.slice(0, 57))
        fed.send(events.slice(57))
        fed.close()
        expect(yield* text(relayed.body)).toBe(events)
        expect(yield* relayed.usage).toEqual({
          input: 12,
          output: 42,
          cacheWrite5m: 100,
          cacheWrite1h: 200,
          cacheRead: 4000,
          complete: true,
        })
      }),
  )

  it.effect(
    "reads a plain answer's usage, a cache write without its split as a five-minute one",
    () =>
      Effect.gen(function* () {
        const { relay } = relayOver(() =>
          Response.json({
            type: 'message',
            usage: { input_tokens: 3, output_tokens: 5, cache_creation_input_tokens: 7 },
          }),
        )
        const relayed = yield* relay(call)
        expect(yield* text(relayed.body)).toContain('"type":"message"')
        expect(yield* relayed.usage).toEqual({
          input: 3,
          output: 5,
          cacheWrite5m: 7,
          cacheWrite1h: 0,
          cacheRead: 0,
          complete: true,
        })
      }),
  )

  it.effect(
    'keeps what was used when the reader goes away mid-stream, and stops reading upstream',
    () =>
      Effect.gen(function* () {
        const fed = handFed()
        const { relay } = relayOver(() => streamed(fed.stream))
        const relayed = yield* relay(call)
        const reader = relayed.body?.getReader()
        if (reader === undefined) throw new Error('No body was relayed')
        fed.send(
          eventStream([
            {
              type: 'message_start',
              message: { usage: { input_tokens: 9, output_tokens: 1 } },
            },
          ]),
        )
        yield* next(reader)
        yield* Effect.promise(() => reader.cancel('stopped'))
        expect(fed.state.cancelled).toBe(true)
        expect(yield* relayed.usage).toMatchObject({ input: 9, output: 1, complete: false })
      }),
  )

  it.effect('says an answer cut short upstream, before its `message_stop`, came short', () =>
    Effect.gen(function* () {
      const fed = handFed()
      const { relay } = relayOver(() => streamed(fed.stream))
      const relayed = yield* relay(call)
      fed.send(eventStream([{ type: 'message_start', message: { usage: { input_tokens: 4 } } }]))
      fed.close()
      yield* text(relayed.body)
      expect(yield* relayed.usage).toMatchObject({ input: 4, output: 0, complete: false })
    }),
  )

  it.effect('reads a count of tokens as a whole answer that used nothing', () =>
    Effect.gen(function* () {
      const { relay } = relayOver(() => Response.json({ input_tokens: 12 }))
      const relayed = yield* relay({ ...call, endpoint: 'count_tokens' })
      expect(yield* text(relayed.body)).toBe('{"input_tokens":12}')
      expect(yield* relayed.usage).toEqual({
        input: 0,
        output: 0,
        cacheWrite5m: 0,
        cacheWrite1h: 0,
        cacheRead: 0,
        complete: true,
      })
    }),
  )

  it.effect('says no usage for an answer Anthropic refused, and relays it as it came', () =>
    Effect.gen(function* () {
      const { relay } = relayOver(() =>
        Response.json(
          { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
          { status: 529 },
        ),
      )
      const relayed = yield* relay(call)
      expect(relayed.status).toBe(529)
      expect(yield* text(relayed.body)).toContain('overloaded_error')
      expect(yield* relayed.usage).toBeUndefined()
    }),
  )

  it.effect('is a defect without the platform key, and calls nothing', () =>
    Effect.gen(function* () {
      const { made, relay } = relayOver(() => new Response(null), '')
      const exit = yield* Effect.exit(relay(call))
      expect(Exit.isFailure(exit) && String(exit.cause)).toContain('ANTHROPIC_API_KEY')
      expect(made).toHaveLength(0)
    }),
  )
})
