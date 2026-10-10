import { type Effect, Exit, Option, Redacted } from 'effect'
import { describe, expect, it } from 'vitest'

import type { Entry } from '#/domains/assistant/entities'
import * as Iam from '#/domains/iam/iam'
import { browser } from '#/repositories/auth/testing'
import { transactional } from '#/repositories/database/database'

import * as Mapping from '../mapping/programs'
import { bearer, call, connect, endpoint, value } from '../server/mcp/testing'
import { serveMcp } from '../server/mcp/mcp'
import type { Failure } from '../report/errors/failure'
import { noKey, noSession, provenKey, run, type Services, type StartContext } from '../server/run'
import * as Assistant from './programs'

// A Turn and its Key, through the helper, on the runtime's repositories over PGlite, Better Auth for
// real: started from a Session for an Account the allowlist names (`vitest.config.ts` names
// `entitled@example.com`), its Key taken by `/mcp`, whose writes the timeline labels "Assistant",
// then refused once the Turn ended, or expired; and refused wherever only a Session may act.

/** Someone signed up with this email, and a request their Session proves. */
async function signedUp(email: string) {
  const device = browser()
  const context = (): StartContext => ({
    requestId: 'req-turn',
    scope: 'test',
    waitUntil: () => undefined,
    exchange: device.exchange(),
    session: Exit.succeed(Option.none()),
    key: noKey,
  })
  await value(run(context(), Iam.signUp({ email, password: 'lovelace1815' })))
  const session = await value(run(context(), Iam.proven))
  const signedIn: StartContext = { ...context(), session: Exit.succeed(session) }
  const asked = await value(run(signedIn, Assistant.postMessage({ text: 'Name my vault.' })))
  return { signedIn, message: asked.id }
}

/** A request whose Bearer header carries `secret`, as `/mcp` proves it: its Key, no Session. */
async function byBearer(secret: string): Promise<StartContext> {
  const exchange = {
    url: endpoint,
    headers: new Headers(bearer(secret)),
    setCookies: () => undefined,
  }
  return {
    requestId: 'req-turn-key',
    scope: 'test',
    waitUntil: () => undefined,
    exchange,
    session: noSession,
    key: await provenKey(exchange),
  }
}

/** What `/mcp` answers a request listing its tools, with these headers. */
async function listed(headers: Record<string, string>) {
  const response = await serveMcp(
    new Request(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }),
  )
  return response.status
}

/** Today's Changes in the Account's Conversation, once the bus recorded `count` of them. */
async function changesRecorded(signedIn: StartContext, count: number) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const { entries } = await value(run(signedIn, Assistant.conversationDay({ offset: 0 })))
    const changes = entries.filter(
      (entry): entry is Extract<Entry, { _tag: 'Change' }> => entry._tag === 'Change',
    )
    if (changes.length >= count) return changes
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Fewer than ${String(count)} Changes were recorded`)
}

const location = 'tile-1'

describe('a Turn and its Key', () => {
  const entitled = signedUp('entitled@example.com')

  it("starts from a Session entitled to the Assistant, with its Key, which `/mcp` takes and the timeline labels 'Assistant'", async () => {
    const { signedIn, message } = await entitled
    const { root } = await value(run(signedIn, Mapping.system))
    const { turn, key } = await value(run(signedIn, Assistant.startTurn({ message, location })))
    expect(turn).toMatchObject({ message, location, spent: 0 })
    expect(key.expiresAt).toEqual(new Date(turn.startedAt.getTime() + 15 * 60_000))

    const secret = Redacted.value(key.secret)
    const proof = await value(run(await byBearer(secret), Iam.signedIn))
    expect(proof.by).toEqual({
      _tag: 'TurnKey',
      conversationId: turn.conversationId,
      turnId: turn.id,
    })

    const client = await connect(bearer(secret))
    const edited = await call(client, 'edit_tile', {
      id: root.id,
      version: root.version,
      title: 'Ada',
    })
    expect(edited).toMatchObject({ value: { title: 'Ada' } })
    const [change] = await changesRecorded(signedIn, 1)
    expect(change).toMatchObject({ verb: 'TileEdited', actor: { _tag: 'Assistant' } })
    await client.close()

    const ended = await value(
      run(signedIn, Assistant.endTurn(proof.account.id, turn.id, 'answered')),
    )
    expect(ended?.ended?.how).toBe('answered')
    expect(await listed(bearer(secret))).toBe(401)
  })

  it('runs one at a time in a Conversation', async () => {
    const { signedIn, message } = await entitled
    const { turn } = await value(run(signedIn, Assistant.startTurn({ message, location })))
    expect(await run(signedIn, Assistant.startTurn({ message, location }))).toMatchObject({
      ok: false,
      failure: { _tag: 'TurnRunning', kind: 'Conflict' },
    })
    const accountId = (await value(run(signedIn, Iam.signedIn))).account.id
    await value(run(signedIn, Assistant.endTurn(accountId, turn.id, 'stopped')))
  })

  it('is refused, with its Key, wherever only a Session may act, a Turn started from it included', async () => {
    const { signedIn, message } = await entitled
    const { turn, key } = await value(run(signedIn, Assistant.startTurn({ message, location })))
    const byKey = await byBearer(Redacted.value(key.secret))
    const sessionOnly: ReadonlyArray<Effect.Effect<unknown, Failure, Services>> = [
      Assistant.startTurn({ message, location }),
      Assistant.postMessage({ text: 'Me again' }),
      Assistant.latest,
      Assistant.assistantAvailable,
      Iam.issueKey('mine now'),
      Iam.keys,
    ]
    for (const program of sessionOnly) {
      expect(await run(byKey, program)).toMatchObject({
        ok: false,
        failure: { _tag: 'SessionRequired', kind: 'Forbidden' },
      })
    }
    expect(await value(run(signedIn, Iam.keys))).toEqual([])
    const accountId = (await value(run(signedIn, Iam.signedIn))).account.id
    await value(run(signedIn, Assistant.endTurn(accountId, turn.id, 'stopped')))
  })

  it('proves nothing past its expiry', async () => {
    const { signedIn } = await entitled
    const turn = { conversationId: crypto.randomUUID(), turnId: crypto.randomUUID() }
    const expired = await value(
      run(signedIn, transactional(Iam.issueTurnKey(turn, new Date(Date.now() - 1000)))),
    )
    expect(await listed(bearer(Redacted.value(expired.secret)))).toBe(401)
    const live = await value(
      run(signedIn, transactional(Iam.issueTurnKey(turn, new Date(Date.now() + 60_000)))),
    )
    expect(await listed(bearer(Redacted.value(live.secret)))).toBe(200)
  })

  it('is refused EntitlementMissing for an Account the list does not name, which the composer is told', async () => {
    const { signedIn: entitledIn } = await entitled
    expect(await value(run(entitledIn, Assistant.assistantAvailable))).toBe(true)

    const { signedIn, message } = await signedUp(`${crypto.randomUUID()}@example.com`)
    expect(await value(run(signedIn, Assistant.assistantAvailable))).toBe(false)
    expect(await run(signedIn, Assistant.startTurn({ message, location }))).toMatchObject({
      ok: false,
      failure: { _tag: 'EntitlementMissing', kind: 'Forbidden', entitlement: 'assistant' },
    })
  })

  it('starts nowhere without a Session', async () => {
    const nobody: StartContext = {
      requestId: 'req-nobody',
      scope: 'test',
      waitUntil: () => undefined,
      exchange: { url: endpoint, headers: new Headers(), setCookies: () => undefined },
      session: noSession,
      key: noKey,
    }
    expect(await run(nobody, Assistant.startTurn({ message: 'm', location }))).toMatchObject({
      ok: false,
      failure: { _tag: 'SignedOut' },
    })
  })
})
