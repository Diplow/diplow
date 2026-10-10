import { Exit, Option, Redacted } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'

import * as Iam from '#/domains/iam/iam'
import { settings } from '#/domains/assistant/settings'
import { eventStream, fakeAnthropic, streamedMessage } from '#/repositories/agent/anthropic/fake'
import { browser } from '#/repositories/auth/testing'
import { Turns } from '#/repositories/database/conversations/turns'
import { transactional } from '#/repositories/database/database'

import * as Assistant from '../../assistant/programs'
import * as Mapping from '../../mapping/programs'
import { value } from '../mcp/testing'
import { noKey, run, type StartContext } from '../run'
import { methodNotAllowed, serveModelCall } from './proxy'

// The model proxy, through its door, on the runtime's repositories over PGlite, Better Auth for real,
// and the fake Anthropic (`vitest.config.ts` empties ANTHROPIC_API_KEY): a Turn's Key proven before
// the body is read, the call let through as the settings say and relayed as it comes, its cost
// recorded on the Turn, and the Turn ended once it reaches its ceiling or the month's allowance.

const base = 'http://localhost/assistant/anthropic'

/** Signed up as the entitled Account, a Message posted, and how to start a Turn answering it. */
async function signedUp() {
  const device = browser()
  const context = (): StartContext => ({
    requestId: 'req-proxy',
    scope: 'test',
    waitUntil: () => undefined,
    exchange: device.exchange(),
    session: Exit.succeed(Option.none()),
    key: noKey,
  })
  await value(
    run(context(), Iam.signUp({ email: 'entitled@example.com', password: 'lovelace1815' })),
  )
  const session = await value(run(context(), Iam.proven))
  const signedIn: StartContext = { ...context(), session: Exit.succeed(session) }
  const asked = await value(run(signedIn, Assistant.postMessage({ text: 'Name my vault.' })))
  const { root } = await value(run(signedIn, Mapping.system))
  const accountId = (await value(run(signedIn, Iam.signedIn))).account.id
  /** Starts a Turn, and answers it with its Key's secret. */
  const turn = async () => {
    const started = await value(
      run(signedIn, Assistant.startTurn({ message: asked.id, location: root.id })),
    )
    return { turn: started.turn, secret: Redacted.value(started.key.secret) }
  }
  /** Ends a Turn, as the code running it does. */
  const end = (turnId: string) =>
    value(run(signedIn, Assistant.endTurn(accountId, turnId, 'answered')))
  return { signedIn, accountId, turn, end }
}

/** What one of the Account's running Turns, and its month, spent and reserved, as Assistant reads it. */
async function spendingOf(turnId: string) {
  const { signedIn, accountId } = await account
  const now = new Date()
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const spending = await value(
    run(signedIn, transactional(Turns.use((turns) => turns.spending(accountId, turnId, month)))),
  )
  if (spending === undefined) throw new Error('The Turn is not running')
  return spending
}

/** A call as Claude Code sends one. */
const callBody = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    model: 'claude-sonnet-5-5',
    max_tokens: 4096,
    stream: true,
    messages: [{ role: 'user', content: 'Name my vault.' }],
    ...extra,
  })

/**
 * Asks the proxy, with `secret` as its Bearer Key when given, and answers its response, the request,
 * whose body says whether it was read, and the work the platform was asked to wait for.
 */
async function ask(options: {
  readonly secret?: string
  readonly path?: string
  readonly body?: string
  readonly headers?: Record<string, string>
}) {
  const waited: Array<Promise<unknown>> = []
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
    ...options.headers,
  }
  if (options.secret !== undefined) headers.authorization = `Bearer ${options.secret}`
  const path = options.path ?? '/v1/messages'
  const request = Object.assign(
    new Request(`${base}${path}`, { method: 'POST', headers, body: options.body ?? callBody() }),
    { waitUntil: (promise: Promise<unknown>) => void waited.push(promise) },
  )
  const response = await serveModelCall(request, path)
  return { response, request, settled: () => Promise.all(waited) }
}

/** What the proxy answered, as Anthropic words an error. */
const errorOf = async (response: Response) =>
  ((await response.json()) as { error: { type: string; message: string } }).error

const account = signedUp()

afterEach(() => {
  fakeAnthropic.reset()
})

describe('the model proxy', () => {
  it('refuses a call no Turn proves before reading its body: no Key, a bad one, an expired one, an Account’s', async () => {
    const { signedIn } = await account
    const missing = await ask({})
    expect(missing.response.status).toBe(401)
    expect(await errorOf(missing.response)).toMatchObject({ type: 'authentication_error' })
    expect(missing.request.bodyUsed).toBe(false)

    const bad = await ask({ secret: 'hft_not-a-key' })
    expect(bad.response.status).toBe(401)
    expect(bad.request.bodyUsed).toBe(false)

    const binding = { conversationId: crypto.randomUUID(), turnId: crypto.randomUUID() }
    const expired = await value(
      run(signedIn, transactional(Iam.issueTurnKey(binding, new Date(Date.now() - 1000)))),
    )
    const late = await ask({ secret: Redacted.value(expired.secret) })
    expect(late.response.status).toBe(401)
    expect(late.request.bodyUsed).toBe(false)

    const issued = await value(run(signedIn, Iam.issueKey('script')))
    const accountKey = await ask({ secret: issued.secret })
    expect(accountKey.response.status).toBe(401)
    expect(accountKey.request.bodyUsed).toBe(false)
    expect(fakeAnthropic.calls()).toHaveLength(0)
  })

  it('relays a call as it comes, its headers passed, the platform key in place of the Turn’s', async () => {
    const { turn, end } = await account
    const { turn: started, secret } = await turn()
    const betas = 'claude-code-20250219,interleaved-thinking-2025-05-14'
    const fed: { send?: (text: string) => void; close?: () => void } = {}
    const upstream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        fed.send = (text) => {
          controller.enqueue(new TextEncoder().encode(text))
        }
        fed.close = () => {
          controller.close()
        }
      },
    })
    fakeAnthropic.answerWith(
      () => new Response(upstream, { headers: { 'content-type': 'text/event-stream' } }),
    )
    const { response } = await ask({ secret, headers: { 'anthropic-beta': betas } })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')

    const [made] = fakeAnthropic.calls()
    expect(made?.url).toBe('https://anthropic.invalid/v1/messages')
    expect(made?.headers.get('anthropic-version')).toBe('2023-06-01')
    expect(made?.headers.get('anthropic-beta')).toBe(betas)
    expect(made?.headers.get('x-api-key')).toBe('fake-platform-key')
    expect(made?.headers.get('authorization')).toBeNull()
    expect(JSON.stringify(made?.body)).not.toContain(secret)

    const reader = response.body?.getReader()
    if (reader === undefined) throw new Error('No body was relayed')
    fed.send?.('event: ping\ndata: {"type":"ping"}\n\n')
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('ping')
    fed.send?.('event: message_stop\ndata: {"type":"message_stop"}\n\n')
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('message_stop')
    fed.close?.()
    expect((await reader.read()).done).toBe(true)
    await end(started.id)
  })

  it('caps `max_tokens`, and serves the count of a call’s tokens', async () => {
    const { turn, end } = await account
    const { turn: started, secret } = await turn()
    await (await ask({ secret, body: callBody({ max_tokens: 128_000 }) })).response.text()
    expect(fakeAnthropic.calls()[0]?.body).toMatchObject({ max_tokens: settings.model.maxTokens })

    fakeAnthropic.answerWith(() => Response.json({ input_tokens: 12 }))
    const counted = await ask({
      secret,
      path: '/v1/messages/count_tokens',
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    expect(await counted.response.json()).toEqual({ input_tokens: 12 })
    expect(fakeAnthropic.calls()[1]?.url).toBe('https://anthropic.invalid/v1/messages/count_tokens')
    await end(started.id)
  })

  it('refuses another endpoint, an unnamed model, field or beta, and a body that is no JSON, calling nothing', async () => {
    const { turn, end } = await account
    const { turn: started, secret } = await turn()
    const other = await ask({ secret, path: '/v1/models' })
    expect(other.response.status).toBe(404)
    expect(await errorOf(other.response)).toMatchObject({ type: 'not_found_error' })

    const refusals = [
      { body: callBody({ model: 'claude-opus-5-5' }) },
      { body: callBody({ mcp_servers: [{ type: 'url', url: 'https://x.test', name: 'x' }] }) },
      { body: callBody({ tools: [{ type: 'web_fetch_20260209', name: 'web_fetch' }] }) },
      { body: callBody(), headers: { 'anthropic-beta': 'mcp-client-2025-11-20' } },
      { body: '{"model":' },
    ]
    for (const refused of refusals) {
      const { response } = await ask({ secret, ...refused })
      expect(response.status).toBe(400)
      expect(await errorOf(response)).toMatchObject({ type: 'invalid_request_error' })
    }
    expect(fakeAnthropic.calls()).toHaveLength(0)
    expect(methodNotAllowed().status).toBe(405)
    await end(started.id)
  })
})

describe('calls under way', () => {
  it('makes a call wait while the calls under way may spend what is left, never ending the Turn', async () => {
    const { turn, end } = await account
    const { turn: started, secret } = await turn()
    const streams: Array<ReadableStreamDefaultController<Uint8Array>> = []
    fakeAnthropic.answerWith(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start: (controller) => {
              streams.push(controller)
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    )
    // Each reserves 32,000 output tokens of Sonnet 5.5, $0.32, and its body as input: three fit
    // under $1 at once, a fourth does not.
    const asked = { secret, body: callBody({ max_tokens: 32_000 }) }
    const under = [await ask(asked), await ask(asked), await ask(asked)]
    expect(under.map(({ response }) => response.status)).toEqual([200, 200, 200])
    const waiting = await ask(asked)
    expect(waiting.response.status).toBe(429)
    expect(waiting.response.headers.get('retry-after')).toBe('2')
    expect(await errorOf(waiting.response)).toMatchObject({ type: 'rate_limit_error' })
    expect(fakeAnthropic.calls()).toHaveLength(3)

    // Once they end, having used nothing, what they reserved is released and a call goes again.
    const stop = new TextEncoder().encode(eventStream([{ type: 'message_stop' }]))
    for (const stream of streams) {
      stream.enqueue(stop)
      stream.close()
    }
    for (const { response, settled } of under) {
      await response.text()
      await settled()
    }
    const again = await ask(asked)
    expect(again.response.status).toBe(200)
    const last = streams.at(-1)
    last?.enqueue(stop)
    last?.close()
    await again.response.text()
    await again.settled()
    expect((await end(started.id))?.spent).toBe(0)
  })

  it('releases what a call reserved when the relay fails to make it', async () => {
    const { turn, end } = await account
    const { turn: started, secret } = await turn()
    fakeAnthropic.answerWith(() => {
      throw new Error('Anthropic is unreachable')
    })
    const failed = await ask({ secret })
    expect(failed.response.status).toBe(500)
    expect(await errorOf(failed.response)).toMatchObject({ type: 'api_error' })
    expect((await spendingOf(started.id)).turn).toEqual({ spent: 0, reserved: 0 })
    await end(started.id)
  })

  it('settles a call whose answer ends after its Turn ended, on that Turn', async () => {
    const { turn, end } = await account
    const { turn: started, secret } = await turn()
    const fed: { stream?: ReadableStreamDefaultController<Uint8Array> } = {}
    fakeAnthropic.answerWith(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start: (controller) => {
              fed.stream = controller
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    )
    const call = await ask({ secret, body: callBody({ max_tokens: 1000 }) })
    expect((await end(started.id))?.spent).toBe(0)

    // The month as another Turn reads it, the ended one's call still reserved.
    const next = await turn()
    const month = async () => (await spendingOf(next.turn.id)).month
    const before = await month()
    expect(before.reserved).toBeGreaterThan(0)

    fed.stream?.enqueue(
      new TextEncoder().encode(
        eventStream([
          { type: 'message_start', message: { usage: { input_tokens: 100, output_tokens: 1 } } },
          { type: 'message_delta', usage: { output_tokens: 50 } },
          { type: 'message_stop' },
        ]),
      ),
    )
    fed.stream?.close()
    await call.response.text()
    await call.settled()
    // 100 input tokens at $2 and 50 output tokens at $10, its reservation released.
    expect(await month()).toEqual({ spent: before.spent + 700, reserved: 0 })
    await end(next.turn.id)
  })
})

describe("a Turn's spend", () => {
  it('records what each call cost on its Turn once its answer has ended', async () => {
    const { turn, end } = await account
    const { turn: started, secret } = await turn()
    fakeAnthropic.answerWith(() =>
      streamedMessage('Ada', { input_tokens: 1000, output_tokens: 200 }),
    )
    const first = await ask({ secret })
    await first.response.text()
    await first.settled()
    const haiku = await ask({ secret, body: callBody({ model: 'claude-haiku-4-5' }) })
    await haiku.response.text()
    await haiku.settled()
    // Sonnet 5.5: 1000×2 + 200×10; Haiku 4.5: 1000×1 + 200×5.
    const ended = await end(started.id)
    expect(ended?.spent).toBe(4000 + 2000)
  })

  it('ends a Turn by its ceiling once it spent it, the call before it let through just below', async () => {
    const { turn } = await account
    const { secret } = await turn()
    // Just below the ceiling: 99,999 output tokens of Sonnet 5.5 at $10 per million.
    fakeAnthropic.answerWith(() =>
      streamedMessage('Ada', { input_tokens: 0, output_tokens: settings.turn.ceiling / 10 - 1 }),
    )
    const below = await ask({ secret })
    await below.response.text()
    await below.settled()
    // Then five input tokens at $2 per million: the Turn stands at its ceiling.
    fakeAnthropic.answerWith(() => streamedMessage('Ada', { input_tokens: 5, output_tokens: 0 }))
    const at = await ask({ secret })
    expect(at.response.status).toBe(200)
    await at.response.text()
    await at.settled()

    const held = await ask({ secret })
    expect(held.response.status).toBe(402)
    expect(await errorOf(held.response)).toEqual({
      type: 'billing_error',
      message: 'This Turn reached its ceiling: it spent what one Turn may.',
    })
    expect(fakeAnthropic.calls()).toHaveLength(2)
    // Ended, its Key revoked: the next call proves nothing, and another Turn may start.
    expect((await ask({ secret })).response.status).toBe(401)
    const next = await turn()
    await (await account).end(next.turn.id)
  })

  it('charges a call cut short the output it may have answered', async () => {
    const { turn, end } = await account
    const { turn: started, secret } = await turn()
    // A stream that ends before its `message_stop`, as one a reader cancels does.
    fakeAnthropic.answerWith(
      () =>
        new Response(
          eventStream([
            { type: 'message_start', message: { usage: { input_tokens: 0, output_tokens: 1 } } },
          ]),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    )
    const cut = await ask({ secret, body: callBody({ max_tokens: 1000 }) })
    await cut.response.text()
    await cut.settled()
    // 1000 output tokens of Sonnet 5.5 at $10 per million.
    expect((await end(started.id))?.spent).toBe(10_000)
  })

  it("ends a Turn by the month's allowance once the Account's Turns spent it", async () => {
    const { turn, end } = await account
    // One Turn spends the whole allowance: a million output tokens of Sonnet 5.5, $10.
    fakeAnthropic.answerWith(() =>
      streamedMessage('Ada', { input_tokens: 0, output_tokens: settings.month.allowance / 10 }),
    )
    const spender = await turn()
    const spent = await ask({ secret: spender.secret })
    await spent.response.text()
    await spent.settled()
    await end(spender.turn.id)

    const { secret } = await turn()
    const held = await ask({ secret })
    expect(held.response.status).toBe(402)
    expect(await errorOf(held.response)).toEqual({
      type: 'billing_error',
      message: "The Account's allowance for the month is spent.",
    })
    expect(fakeAnthropic.calls()).toHaveLength(1)
    expect((await ask({ secret })).response.status).toBe(401)
  })
})
