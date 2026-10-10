import { Redacted } from 'effect'
import { describe, expect, it } from 'vitest'

import * as Iam from '#/domains/iam/iam'

import * as Assistant from '../../assistant/programs'
import * as Mapping from '../../mapping/programs'
import { value } from '../mcp/testing'
import { run } from '../run'
import { serveTurnEvent } from './events'
import { signedUpAt } from './testing'

// The Turn's events door over PGlite, Better Auth for real, fed lines recorded as Claude Code writes
// them with `-p --output-format stream-json --verbose`: a request no running Turn proves refused before
// its body is read; the agent's text kept as its Messages, its step shown by the poll then dropped, its
// result ending the Turn and revoking its Key; a malformed line refused, the Turn going on; a line
// naming another Conversation followed on the Key's own; and each bad ending told in the timeline.

const events = 'http://localhost/assistant/events'

/** Posts one line to the door, with `secret` as its Bearer Key when given. */
async function post(line: string, secret?: string) {
  const request = new Request(events, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret !== undefined && { authorization: `Bearer ${secret}` }),
    },
    body: line,
  })
  const response = await serveTurnEvent(request)
  return { status: response.status, read: request.bodyUsed }
}

/** Lines of the agent's stream, as Claude Code writes them. */
const line = {
  said: (text: string) =>
    JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text }] },
      session_id: 's',
    }),
  running: (name: string, input: Record<string, unknown>) =>
    JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name, input }] },
    }),
  result: (subtype: string) =>
    JSON.stringify({ type: 'result', subtype, is_error: subtype !== 'success', result: 'Done.' }),
  exited: JSON.stringify({ type: 'hexframe_exit', code: 1, signal: null }),
}

const account = (async () => {
  const someone = await signedUpAt('http://localhost', 'entitled@example.com')
  const { root } = await value(run(someone.signedIn, Mapping.system))
  /** Starts a Turn answering a new Message, at the Root, and answers it with its Key's secret. */
  const turn = async () => {
    const asked = await value(run(someone.signedIn, Assistant.postMessage({ text: 'Help me.' })))
    const { turn: started, key } = await value(
      run(someone.signedIn, Assistant.startTurn({ message: asked.id, location: root.id })),
    )
    return { turn: started, secret: Redacted.value(key.secret) }
  }
  /** Today's Entries, as the chat reads them. */
  const today = async () =>
    (await value(run(someone.signedIn, Assistant.conversationDay({ offset: 0 })))).entries
  /** What the page's poll sees running. */
  const live = async () => (await value(run(someone.signedIn, Assistant.latest))).turn
  return { ...someone, turn, today, live }
})()

describe("the Turn's events door", () => {
  it('refuses a line no running Turn proves before reading it: no Key, an Account’s, an ended Turn’s', async () => {
    const { signedIn, accountId, turn } = await account
    expect(await post(line.said('Hi'))).toEqual({ status: 401, read: false })
    expect(await post(line.said('Hi'), 'hft_not-a-key')).toEqual({ status: 401, read: false })
    const issued = await value(run(signedIn, Iam.issueKey('script')))
    expect(await post(line.said('Hi'), issued.secret)).toEqual({ status: 401, read: false })

    const ended = await turn()
    await value(run(signedIn, Assistant.endTurn(accountId, ended.turn.id, 'answered')))
    expect(await post(line.said('Hi'), ended.secret)).toEqual({ status: 401, read: false })
  })

  it('keeps the agent’s text as its Messages, shows its step live, then drops it as it speaks', async () => {
    const { signedIn, accountId, turn, today, live } = await account
    const { turn: running, secret } = await turn()
    expect(await live()).toEqual({ id: running.id })

    expect(await post(line.running('Bash', { command: 'ls -R' }), secret)).toEqual({
      status: 204,
      read: true,
    })
    expect(await live()).toEqual({ id: running.id, step: { tool: 'Bash', detail: 'ls -R' } })
    await post(line.said('Your System holds one Tile.'), secret)
    expect(await live()).toEqual({ id: running.id })
    expect((await today()).at(-1)).toMatchObject({
      _tag: 'Message',
      author: 'agent',
      text: 'Your System holds one Tile.',
    })
    await value(run(signedIn, Assistant.endTurn(accountId, running.id, 'answered')))
  })

  it('keeps no Turn’s Key its agent says, the very Key IAM issued it included', async () => {
    const { signedIn, accountId, turn, today, live } = await account
    const { turn: running, secret } = await turn()
    await post(
      line.running('Bash', { command: `curl -H "Authorization: Bearer ${secret}"` }),
      secret,
    )
    expect(JSON.stringify(await live())).not.toContain(secret)
    await post(line.said(`My environment holds ${secret}.`), secret)
    expect(JSON.stringify(await today())).not.toContain(secret)
    await value(run(signedIn, Assistant.endTurn(accountId, running.id, 'answered')))
  })

  it('ends the Turn by its result and revokes its Key, the answer told by its Messages alone', async () => {
    const { turn, today, live } = await account
    const { secret } = await turn()
    await post(line.said('Done.'), secret)
    expect(await post(line.result('success'), secret)).toEqual({ status: 204, read: true })
    expect(await live()).toBeUndefined()
    expect((await today()).at(-1)).toMatchObject({ _tag: 'Message', author: 'agent' })
    expect((await post(line.said('Still here?'), secret)).status).toBe(401)
  })

  it('refuses a malformed line, a line past the longest, and the Turn goes on', async () => {
    const { signedIn, accountId, turn, live } = await account
    const { turn: running, secret } = await turn()
    for (const malformed of ['not json', '{"message":{}}', '[1, 2]']) {
      expect((await post(malformed, secret)).status, malformed).toBe(400)
    }
    expect((await post(line.said('x'.repeat(1024 * 1024 + 1)), secret)).status).toBe(413)
    expect(await live()).toEqual({ id: running.id })
    await value(run(signedIn, Assistant.endTurn(accountId, running.id, 'answered')))
  })

  it('follows a line on the Key’s own Turn, whatever Conversation or session it names', async () => {
    const { signedIn, accountId, turn, today } = await account
    const { turn: running, secret } = await turn()
    const naming = JSON.stringify({
      ...(JSON.parse(line.said('Mine.')) as object),
      conversationId: crypto.randomUUID(),
      turnId: crypto.randomUUID(),
      session_id: crypto.randomUUID(),
    })
    expect((await post(naming, secret)).status).toBe(204)
    expect((await today()).at(-1)).toMatchObject({ author: 'agent', text: 'Mine.' })
    await value(run(signedIn, Assistant.endTurn(accountId, running.id, 'answered')))
  })

  it.each([
    ['its sandbox, the agent exited without a result', line.exited, 'sandbox'],
    ['its ceiling, the agent spent its budget', line.result('error_max_budget_usd'), 'ceiling'],
    ['its sandbox, the agent failed', line.result('error_during_execution'), 'sandbox'],
  ] as const)(
    'tells in the timeline a Turn ended by %s, and revokes its Key',
    async (_, ending, how) => {
      const { signedIn, accountId, turn, today, live } = await account
      const running = await live()
      if (running !== undefined) {
        await value(run(signedIn, Assistant.endTurn(accountId, running.id, 'answered')))
      }
      const { secret } = await turn()
      expect((await post(ending, secret)).status).toBe(204)
      expect(await live()).toBeUndefined()
      expect((await today()).at(-1)).toMatchObject({ _tag: 'TurnEnded', how })
      expect((await post(line.said('Hello?'), secret)).status).toBe(401)
    },
  )
})
