import { Exit, Option, Redacted } from 'effect'
import { describe, expect, it } from 'vitest'

import type { Entry } from '#/domains/assistant/entities'
import * as Iam from '#/domains/iam/iam'
import { browser } from '#/repositories/auth/testing'

import * as Mapping from '../../mapping/programs'
import { bearer, call, connect, content, value } from '../../server/mcp/testing'
import { noKey, noSession, provenKey, run, type StartContext } from '../../server/run'
import * as Assistant from '../programs'
import * as Proposal from './programs'

// Undo through the helper and `/mcp`, on the runtime's repositories over PGlite, Better Auth for real:
// an accepted Proposal undone whole, its Entry saying so, its changes landing as the user's, and once
// only; what a Turn in apply wrote undone once it ended, never while it runs; refused whole once a
// Tile it touched changed since, nothing changed; and from a Session only. What the refusal says is
// the message table's (`report/errors/messages.test.ts`).

/** Someone the allowlist names (`vitest.config.ts`), signed in. */
async function signedUp() {
  const device = browser()
  const context = (): StartContext => ({
    requestId: 'req-undo',
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
  const accountId = (await value(run(signedIn, Iam.signedIn))).account.id
  return { signedIn, accountId }
}

const someone = signedUp()

/** Starts a Turn from a Message, in the Mode the Conversation is in, and an MCP client with its Key. */
async function turnStarted(text: string) {
  const { signedIn, accountId } = await someone
  const { root } = await value(run(signedIn, Mapping.system))
  const asked = await value(run(signedIn, Assistant.postMessage({ text })))
  const { turn, key } = await value(
    run(signedIn, Assistant.startTurn({ message: asked.id, location: root.id })),
  )
  const client = await connect(bearer(Redacted.value(key.secret)))
  const end = async () => {
    await client.close()
    await value(run(signedIn, Assistant.endTurn(accountId, turn.id, 'answered')))
  }
  return { turn, client, root, end }
}

/** Today's Entries of the Conversation. */
const today = async () => {
  const { signedIn } = await someone
  return (await value(run(signedIn, Assistant.conversationDay({ offset: 0 })))).entries
}

/** Today's Entries of one kind. */
const entriesOf = async <T extends Entry['_tag']>(tag: T) =>
  (await today()).filter((entry): entry is Extract<Entry, { _tag: T }> => entry._tag === tag)

/** Today's Changes, once the bus recorded `count` of them. */
async function changesRecorded(count: number) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const changes = await entriesOf('Change')
    if (changes.length >= count) return changes
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Fewer than ${String(count)} Changes were recorded`)
}

/** The Titles of the System's Tiles below its Root, as a Session reads it, in no order. */
const titlesHeld = async () => {
  const { signedIn } = await someone
  const { tiles } = await value(run(signedIn, Mapping.system))
  return Object.values(tiles)
    .flatMap((held) => (held._tag === 'Tile' ? [held.title] : []))
    .sort()
}

/** The answer of a write that created or edited a Tile. */
const tileOf = (answer: { value?: unknown; error?: string }) => {
  if (answer.value === undefined) throw new Error(`Expected a Tile, got ${String(answer.error)}`)
  return answer.value as { id: string; version: number; title: string }
}

/** Undoes what the Assistant applied, by its id, as the user's Session. */
const undone = async (batch: string) => {
  const { signedIn } = await someone
  return run(signedIn, Proposal.undo({ batch }))
}

describe('an accepted Proposal', () => {
  it('is undone whole, its changes landing as yours, then offers no second Undo', async () => {
    const { signedIn } = await someone
    const { client, root, end } = await turnStarted('Lay out Work.')
    const work = tileOf(
      await call(client, 'create_tile', { parent: root.id, slot: 1, ...content('Work') }),
    )
    await call(client, 'create_tile', { parent: work.id, slot: 2, ...content('Team') })
    await end()
    const [open] = await entriesOf('Proposal')
    if (open === undefined) throw new Error('No Proposal is open')
    await value(run(signedIn, Proposal.acceptProposal({ proposal: open.proposal })))
    expect(await titlesHeld()).toEqual(['Team', 'Work'])
    await changesRecorded(2)

    expect(await undone(open.proposal)).toMatchObject({ ok: true })
    expect(await titlesHeld()).toEqual([])
    const changes = await changesRecorded(4)
    expect(changes.map(({ verb, actor }) => `${actor._tag} ${verb}`)).toEqual([
      'Assistant TileCreated',
      'Assistant TileCreated',
      'You TileDeleted',
      'You TileDeleted',
    ])
    expect((await entriesOf('Proposal')).map(({ fate }) => fate)).toEqual(['undone'])
    expect(await undone(open.proposal)).toMatchObject({
      ok: false,
      failure: { _tag: 'NothingToUndo', kind: 'Conflict' },
    })
  })
})

describe('what a Turn in apply wrote', () => {
  it('is undone whole once the Turn ended, never while it runs', async () => {
    const { signedIn } = await someone
    await value(run(signedIn, Proposal.setMode({ mode: 'apply' })))
    const before = await titlesHeld()
    const { turn, client, root, end } = await turnStarted('Plan the year.')
    const plans = tileOf(
      await call(client, 'create_tile', { parent: root.id, slot: 3, ...content('Plans') }),
    )
    expect(plans).toMatchObject({ title: 'Plans', version: 1 })
    await call(client, 'create_tile', { parent: plans.id, slot: 1, ...content('Q1') })
    const renamed = tileOf(
      await call(client, 'edit_tile', { id: plans.id, version: plans.version, title: 'Roadmap' }),
    )
    expect(renamed).toMatchObject({ title: 'Roadmap', version: 2 })
    expect(await titlesHeld()).toEqual([...before, 'Q1', 'Roadmap'].sort())
    expect(await undone(turn.id)).toMatchObject({ ok: false, failure: { _tag: 'NothingToUndo' } })
    await end()

    expect((await entriesOf('TurnApplied')).at(-1)).toEqual(
      expect.objectContaining({ turn: turn.id, changes: 3, undone: false }),
    )
    expect(await undone(turn.id)).toMatchObject({ ok: true })
    expect(await titlesHeld()).toEqual(before)
    expect((await entriesOf('TurnApplied')).at(-1)).toMatchObject({ undone: true })
  })

  it('is refused whole once a Tile it touched changed since, nothing changed', async () => {
    const { signedIn } = await someone
    const { turn, client, root, end } = await turnStarted('Add notes.')
    const notes = tileOf(
      await call(client, 'create_tile', { parent: root.id, slot: 5, ...content('Notes') }),
    )
    await end()
    await value(
      run(signedIn, Mapping.editTile({ id: notes.id, version: notes.version, body: 'Mine.' })),
    )
    const held = await value(run(signedIn, Mapping.system))
    const refused = await undone(turn.id)
    expect(refused).toMatchObject({
      ok: false,
      failure: { _tag: 'BatchOutdated', kind: 'Conflict' },
    })
    expect(await value(run(signedIn, Mapping.system))).toEqual(held)
    expect((await entriesOf('TurnApplied')).at(-1)).toMatchObject({ undone: false })
  })

  it('is undone from a Session only', async () => {
    const { signedIn } = await someone
    const { turn, client, root, end } = await turnStarted('One more.')
    await call(client, 'create_tile', { parent: root.id, slot: 6, ...content('More') })
    await end()
    const { secret } = await value(run(signedIn, Iam.issueKey('Script')))
    const exchange = {
      url: 'http://localhost/mcp',
      headers: new Headers(bearer(secret)),
      setCookies: () => undefined,
    }
    const byKey: StartContext = {
      ...signedIn,
      exchange,
      session: noSession,
      key: await provenKey(exchange),
    }
    expect(await run(byKey, Proposal.undo({ batch: turn.id }))).toMatchObject({
      ok: false,
      failure: { _tag: 'SessionRequired' },
    })
    expect(await titlesHeld()).toContain('More')
  })
})
