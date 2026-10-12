import { Effect, Exit, Option, Redacted } from 'effect'
import { describe, expect, it } from 'vitest'

import type { Entry } from '#/domains/assistant/entities'
import * as Iam from '#/domains/iam/iam'
import { CreateTile } from '#/domains/mapping/operations'
import { browser } from '#/repositories/auth/testing'

import * as Mapping from '../../mapping/programs'
import { turnStarted as sentTurn } from '../../server/events/testing'
import { bearer, call, connect, content, value } from '../../server/mcp/testing'
import { noKey, noSession, provenKey, run, type StartContext } from '../../server/run'
import * as Assistant from '../programs'
import * as Proposal from './programs'

// The Mode and the Proposal through the helper and `/mcp`, on the runtime's repositories over PGlite,
// Better Auth for real: a Turn started in ask drafting its writes into the Proposal, which its reads
// show and the System does not hold, refused as Mapping refuses them there, continued by the next
// Turn; accepted whole as the Assistant's, refused once a Tile it names changed since, or discarded;
// a Turn in apply, and an Account's Key, writing the System as it stands.

/** Someone the allowlist names (`vitest.config.ts`), signed in, and their Root. */
async function signedUp() {
  const device = browser()
  const context = (): StartContext => ({
    requestId: 'req-proposal',
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
  const { signedIn } = await someone
  const { root } = await value(run(signedIn, Mapping.system))
  const { turn, key } = await value(run(signedIn, sentTurn(text, root.id)))
  const client = await connect(bearer(Redacted.value(key.secret)))
  const end = async () => {
    await client.close()
    const { accountId } = await someone
    await value(run(signedIn, Assistant.endTurn(accountId, turn.id, 'answered')))
  }
  return { turn, client, root, end }
}

/** Today's Entries of the Conversation. */
const today = async () => {
  const { signedIn } = await someone
  return (await value(run(signedIn, Assistant.conversationDay({ offset: 0 })))).entries
}

/** Today's Proposal Entries. */
const proposals = async () =>
  (await today()).filter(
    (entry): entry is Extract<Entry, { _tag: 'Proposal' }> => entry._tag === 'Proposal',
  )

/** Today's Changes, once the bus recorded `count` of them. */
async function changesRecorded(count: number) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const changes = (await today()).filter(
      (entry): entry is Extract<Entry, { _tag: 'Change' }> => entry._tag === 'Change',
    )
    if (changes.length >= count) return changes
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Fewer than ${String(count)} Changes were recorded`)
}

/** The Titles of the System's Tiles below its Root, as a Session reads it. */
const titlesHeld = async () => {
  const { signedIn } = await someone
  const { tiles } = await value(run(signedIn, Mapping.system))
  return Object.values(tiles).flatMap((held) => (held._tag === 'Tile' ? [held.title] : []))
}

/** The answer of a write that created or edited a Tile. */
const tileOf = (answer: { value?: unknown; error?: string }) => {
  if (answer.value === undefined) throw new Error(`Expected a Tile, got ${String(answer.error)}`)
  return answer.value as { id: string; version: number; title: string }
}

describe('a Turn in ask', () => {
  it('drafts a create and a child under it, its reads showing both, the System holding neither', async () => {
    const { signedIn } = await someone
    const { client, root, end } = await turnStarted('Lay out Work.')
    const work = tileOf(
      await call(client, 'create_tile', { parent: root.id, slot: 1, ...content('Work') }),
    )
    expect(work).toMatchObject({ title: 'Work', version: 1 })
    const team = tileOf(
      await call(client, 'create_tile', { parent: work.id, slot: 2, ...content('Team') }),
    )
    const refused = await call(client, 'create_tile', {
      parent: root.id,
      slot: 1,
      ...content('Again'),
    })
    expect(refused.error).toMatch(/^DirectionTaken: /)

    const mapped = await call(client, 'map', { depth: 2 })
    expect(mapped.value).toMatchObject({
      tile: { branches: { 1: { id: work.id, title: 'Work', branches: { 2: { id: team.id } } } } },
    })
    const opened = await call(client, 'open_tile', { id: work.id })
    expect(opened.value).toMatchObject({ tile: { title: 'Work' }, parent: { id: root.id } })
    expect(await titlesHeld()).toEqual([])

    const [proposal] = await proposals()
    expect(proposal).toMatchObject({
      fate: 'open',
      changes: [
        { verb: 'TileCreated', tile: { id: work.id, title: 'Work' } },
        { verb: 'TileCreated', tile: { id: team.id, title: 'Team' } },
      ],
    })
    expect(await value(run(signedIn, Assistant.latest))).toMatchObject({
      mode: 'ask',
      proposal: { id: proposal?.proposal, drafts: 2 },
    })
    // The day answers the writes themselves, as Mapping batched them, each create with the id it made.
    const { proposal: shown } = await value(run(signedIn, Assistant.conversationDay({ offset: 0 })))
    expect(shown).toMatchObject({ id: proposal?.proposal, drafts: 2 })
    const creates = shown?.writes.map(({ operation: op, made }) =>
      op._tag === 'CreateTile' ? [op.parent, op.slot, op.title, made] : op._tag,
    )
    expect(creates).toEqual([
      [root.id, 1, 'Work', work.id],
      [work.id, 2, 'Team', team.id],
    ])
    await end()
  })

  it('continues the open Proposal in the next Turn, which reads through it and adds to it', async () => {
    const { client, end } = await turnStarted('And a Leaf under Team.')
    const map = await call(client, 'map', { depth: 2 })
    const work = (
      map.value as { tile: { branches: Record<string, { id: string; version: number }> } }
    ).tile.branches['1']
    if (work === undefined) throw new Error('The Proposal shows no Work')
    const edited = tileOf(
      await call(client, 'edit_tile', { id: work.id, version: work.version, title: 'Job' }),
    )
    expect(edited).toMatchObject({ title: 'Job', version: 2 })
    const stale = await call(client, 'edit_tile', { id: work.id, version: 1, title: 'Late' })
    expect(stale.error).toMatch(/^TileChanged: /)
    const all = await proposals()
    expect(all).toHaveLength(1)
    expect(all[0]?.changes.map(({ verb, tile }) => `${verb} ${tile.title}`)).toEqual([
      'TileCreated Work',
      'TileCreated Team',
      'TileEdited Job',
    ])
    await end()
  })

  it('is accepted whole, its writes landing as the Assistant’s, then open no longer', async () => {
    const { signedIn } = await someone
    const [open] = await proposals()
    if (open === undefined) throw new Error('No Proposal is open')
    await value(run(signedIn, Proposal.acceptProposal({ proposal: open.proposal })))
    expect(await titlesHeld()).toEqual(['Job', 'Team'])
    const changes = await changesRecorded(3)
    expect(changes.map(({ verb, actor }) => `${actor._tag} ${verb}`)).toEqual([
      'Assistant TileCreated',
      'Assistant TileCreated',
      'Assistant TileEdited',
    ])
    expect((await proposals()).map(({ fate }) => fate)).toEqual(['accepted'])
    expect(await run(signedIn, Proposal.acceptProposal({ proposal: open.proposal }))).toMatchObject(
      { ok: false, failure: { _tag: 'ProposalClosed', kind: 'Conflict' } },
    )
    expect(await value(run(signedIn, Assistant.latest))).not.toHaveProperty('proposal')
  })

  it('is refused whole once a Tile it names changed since, takes no more drafts, then is discarded', async () => {
    const { signedIn } = await someone
    const { client, root, end } = await turnStarted('Rename me.')
    await call(client, 'edit_tile', { id: root.id, version: root.version, title: 'Ada' })
    await call(client, 'create_tile', { parent: root.id, slot: 3, ...content('Games') })
    await end()
    // The user renames themselves meanwhile, from the Version the Turn read.
    await value(
      run(signedIn, Mapping.editTile({ id: root.id, version: root.version, title: 'Grace' })),
    )
    const open = (await proposals()).at(-1)
    if (open === undefined) throw new Error('No Proposal is open')
    const before = await value(run(signedIn, Mapping.system))
    expect(await run(signedIn, Proposal.acceptProposal({ proposal: open.proposal }))).toMatchObject(
      { ok: false, failure: { _tag: 'BatchOutdated', kind: 'Conflict' } },
    )
    expect(await value(run(signedIn, Mapping.system))).toEqual(before)
    // The next Turn drafts nothing more into it, and is told why.
    const next = await turnStarted('And more.')
    const refused = await call(next.client, 'create_tile', {
      parent: next.root.id,
      slot: 4,
      ...content('More'),
    })
    expect(refused.error).toMatch(/^BatchOutdated: /)
    await next.end()
    await value(run(signedIn, Proposal.discardProposal({ proposal: open.proposal })))
    expect((await proposals()).at(-1)?.fate).toBe('discarded')
    expect(await titlesHeld()).not.toContain('Games')
  })

  it('refuses a write its Key proved just before the Turn ended, drafting nothing, opening no Proposal', async () => {
    const { signedIn, accountId } = await someone
    const { root } = await value(run(signedIn, Mapping.system))
    const { turn, key } = await value(run(signedIn, sentTurn('One last thing.', root.id)))
    const exchange = {
      url: 'http://localhost/mcp',
      headers: new Headers(bearer(Redacted.value(key.secret))),
      setCookies: () => undefined,
    }
    // Its Key proven, then the Turn stopped before the write runs.
    const byTurn: StartContext = {
      ...signedIn,
      exchange,
      session: noSession,
      key: await provenKey(exchange),
    }
    const before = await proposals()
    await value(run(signedIn, Assistant.endTurn(accountId, turn.id, 'stopped')))
    const late = new CreateTile({ parent: root.id, slot: 4, ...content('Late') })
    const written = await run(
      byTurn,
      Proposal.written(late, () => Effect.die(new Error('A Turn’s write ran as its own'))),
    )
    expect(written).toMatchObject({
      ok: false,
      failure: { _tag: 'TurnOver', kind: 'Unauthenticated' },
    })
    expect(await proposals()).toEqual(before)
    expect(await value(run(signedIn, Assistant.latest))).not.toHaveProperty('proposal')
  })
})

describe('a Turn in apply, and an Account’s Key', () => {
  it('write the System as it stands, a Proposal left open read by neither', async () => {
    const { signedIn } = await someone
    const asking = await turnStarted('Draft one.')
    await call(asking.client, 'create_tile', {
      parent: asking.root.id,
      slot: 4,
      ...content('Drafted'),
    })
    await asking.end()

    await value(run(signedIn, Proposal.setMode({ mode: 'apply' })))
    const applying = await turnStarted('Write one.')
    const opened = await call(applying.client, 'open_tile', {})
    expect(opened.value).toMatchObject({ branches: {} })
    expect(opened.value).not.toMatchObject({ branches: { 4: {} } })
    await call(applying.client, 'create_tile', {
      parent: applying.root.id,
      slot: 4,
      ...content('Written'),
    })
    await applying.end()
    expect(await titlesHeld()).toContain('Written')
    expect((await proposals()).at(-1)).toMatchObject({ fate: 'open' })

    // An Account's Key writes as it stands, whatever the Mode.
    await value(run(signedIn, Proposal.setMode({ mode: 'ask' })))
    const { secret } = await value(run(signedIn, Iam.issueKey('Claude Code')))
    const byKey = await connect(bearer(secret))
    await call(byKey, 'create_tile', { parent: asking.root.id, slot: 5, ...content('Keyed') })
    await byKey.close()
    expect(await titlesHeld()).toContain('Keyed')
  })

  it('refuses a write its Key proved just before the Turn in apply ended, running nothing', async () => {
    const { signedIn, accountId } = await someone
    await value(run(signedIn, Proposal.setMode({ mode: 'apply' })))
    const { root } = await value(run(signedIn, Mapping.system))
    const { turn, key } = await value(run(signedIn, sentTurn('Write one more.', root.id)))
    const exchange = {
      url: 'http://localhost/mcp',
      headers: new Headers(bearer(Redacted.value(key.secret))),
      setCookies: () => undefined,
    }
    // Its Key proven, then the Turn stopped before the write runs.
    const byTurn: StartContext = {
      ...signedIn,
      exchange,
      session: noSession,
      key: await provenKey(exchange),
    }
    await value(run(signedIn, Assistant.endTurn(accountId, turn.id, 'stopped')))
    const late = new CreateTile({ parent: root.id, slot: 6, ...content('Too late') })
    const written = await run(
      byTurn,
      Proposal.written(late, () => Effect.die(new Error('A Turn’s write ran as its own'))),
    )
    expect(written).toMatchObject({
      ok: false,
      failure: { _tag: 'TurnOver', kind: 'Unauthenticated' },
    })
    expect(await titlesHeld()).not.toContain('Too late')
    await value(run(signedIn, Proposal.setMode({ mode: 'ask' })))
  })

  it('switches the Mode from a Session only', async () => {
    const { signedIn } = await someone
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
    expect(await run(byKey, Proposal.setMode({ mode: 'apply' }))).toMatchObject({
      ok: false,
      failure: { _tag: 'SessionRequired' },
    })
  })
})
