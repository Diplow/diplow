import { Exit, Option, Redacted } from 'effect'
import { describe, expect, it } from 'vitest'

import type { Entry } from '#/domains/assistant/entities'
import type { Choice } from '#/domains/mapping/entities'
import * as Iam from '#/domains/iam/iam'
import { browser } from '#/repositories/auth/testing'

import * as Mapping from '../../mapping/programs'
import { turnStarted } from '../../server/events/testing'
import { bearer, call, connect, content, value } from '../../server/mcp/testing'
import { noKey, run, type StartContext } from '../../server/run'
import * as Assistant from '../programs'
import * as Proposal from '../proposal/programs'

// A Turn on a Tile of someone else's System (HEX-134), through the helper and `/mcp`, on the
// runtime's repositories over PGlite, Better Auth for real, on the grill's scenario: Ana shares her
// Journal with Bob, the Account `vitest.config.ts` lists entitled, who sends `@Journal`. His Turn runs
// in his own Conversation, in Journal's folder, its Key reading and writing Ana's System alone, with
// Bob's rights there: read-only without *write*, by his Mode with it, each write told in both
// timelines, Ana's offering its Undo; and none starts without *@*.

/** Someone signed up with this email, a request their Session proves, their Account and their star. */
async function signedUp(email: string) {
  const device = browser()
  const context = (): StartContext => ({
    requestId: 'req-elsewhere',
    scope: 'test',
    waitUntil: () => undefined,
    exchange: device.exchange(),
    session: Exit.succeed(Option.none()),
    key: noKey,
  })
  await value(run(context(), Iam.signUp({ email, password: 'lovelace1815' })))
  const session = await value(run(context(), Iam.proven))
  const signedIn: StartContext = { ...context(), session: Exit.succeed(session) }
  const { account } = await value(run(signedIn, Iam.signedIn))
  const { root } = await value(run(signedIn, Mapping.system))
  return { signedIn, accountId: account.id, star: root.id }
}

/** The entitled Account, Bob, his star titled, once per file: its email is the list's one. */
const bob = signedUp('entitled@example.com').then(async (signed) => {
  await value(
    run(signed.signedIn, Mapping.editTile({ id: signed.star, version: 1, title: 'Bob Martin' })),
  )
  return signed
})

/**
 * Ana Lima, signed up anew, her System holding Journal, with Entry below it, and Garden beside it,
 * Journal shared with Bob at `value`.
 */
async function shared(shareValue: Choice) {
  const ana = await signedUp(`${crypto.randomUUID()}@example.com`)
  await value(run(ana.signedIn, Mapping.editTile({ id: ana.star, version: 1, title: 'Ana Lima' })))
  const create = (parent: string, slot: 1 | 2, title: string) =>
    value(run(ana.signedIn, Mapping.createTile({ parent, slot, ...content(title) })))
  const journal = await create(ana.star, 1, 'Journal')
  const entry = await create(journal.id, 1, 'Entry')
  const garden = await create(ana.star, 2, 'Garden')
  const { star: bobStar } = await bob
  const toBob = { _tag: 'Account', star: bobStar } as const
  await value(
    run(ana.signedIn, Mapping.setGrant({ tile: journal.id, subject: toBob, value: shareValue })),
  )
  return { ana, journal, entry, garden }
}

/**
 * Bob's Turn answering `@Journal`, in a Tile, with its Key in hand, an MCP client on it, in the Mode
 * asked; and the end of it, which every test reaches so the next starts.
 */
async function bobsTurn(location: string, mode: 'ask' | 'apply') {
  const { signedIn, accountId } = await bob
  await value(run(signedIn, Proposal.setMode({ mode })))
  const { turn, key } = await value(
    run(signedIn, turnStarted(`@[${location}] tidy this`, location)),
  )
  const client = await connect(bearer(Redacted.value(key.secret)))
  const end = async () => {
    await client.close()
    await value(run(signedIn, Assistant.endTurn(accountId, turn.id, 'answered')))
  }
  return { turn, client, end }
}

/** The day's Entries of an Account's Conversation, once one passes `until`, the bus's work polled. */
async function told(signedIn: StartContext, until: (entries: ReadonlyArray<Entry>) => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const { entries } = await value(run(signedIn, Assistant.conversationDay({ offset: 0 })))
    if (until(entries)) return entries
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('The Conversation was never told')
}

/** The changes someone else made in an Account's System, as its timeline tells them. */
const theirs = (entries: ReadonlyArray<Entry>) =>
  entries.filter((entry) => entry._tag === 'Change' && entry.actor._tag === 'Someone')

/** A tool's refusal, by its tag. */
const refusal = (answer: { error?: string }) => answer.error?.split(':')[0]

describe('a Turn on a Tile of someone else’s System', () => {
  it('starts only where Bob may run the agent, *@*, refused before a Turn without', async () => {
    const { ana, journal, garden } = await shared('read')
    const { signedIn } = await bob
    expect(await run(signedIn, turnStarted('@Journal', journal.id))).toMatchObject({
      ok: false,
      failure: { _tag: 'NotAllowed', kind: 'Forbidden' },
    })
    expect(await run(signedIn, turnStarted('@Garden', garden.id))).toMatchObject({
      ok: false,
      failure: { _tag: 'TileNotFound' },
    })
    // Nothing was posted for either.
    const { entries } = await value(run(signedIn, Assistant.conversationDay({ offset: 0 })))
    expect(entries.some((entry) => entry._tag === 'Message' && entry.text.startsWith('@'))).toBe(
      false,
    )
    // With *@*, in his own Conversation, in Journal, of Ana's System.
    await value(
      run(
        ana.signedIn,
        Mapping.setGrant({
          tile: journal.id,
          subject: { _tag: 'Account', star: (await bob).star },
          value: 'read+@',
        }),
      ),
    )
    const started = await bobsTurn(journal.id, 'apply')
    expect(started.turn).toMatchObject({ location: journal.id, elsewhere: ana.star })
    await started.end()
  })

  it('reads and writes Ana’s System alone, and writes nothing without *write*', async () => {
    const { ana, journal, garden } = await shared('read+@')
    const { star: bobStar, signedIn } = await bob
    const { client, end } = await bobsTurn(journal.id, 'apply')
    expect(await call(client, 'open_tile', { id: journal.id })).toMatchObject({
      value: { tile: { title: 'Journal' } },
    })
    // Without an id, her star, as anyone sees it, its card.
    expect(await call(client, 'open_tile', {})).toMatchObject({
      value: { tile: { id: ana.star, title: 'Ana Lima', body: '' } },
    })
    for (const id of [garden.id, bobStar]) {
      expect(refusal(await call(client, 'open_tile', { id }))).toBe('TileNotFound')
    }
    expect(refusal(await call(client, 'map', { id: bobStar }))).toBe('TileNotFound')
    const edit = { id: journal.id, version: 1, title: 'Ours' }
    expect(refusal(await call(client, 'edit_tile', edit))).toBe('NotAllowed')
    // His own System is out of its reach, a write there too.
    expect(
      refusal(await call(client, 'edit_tile', { id: bobStar, version: 2, title: 'Bob' })),
    ).toBe('TileNotFound')
    await end()
    // In ask, no Proposal is made either.
    const asking = await bobsTurn(journal.id, 'ask')
    expect(refusal(await call(asking.client, 'edit_tile', edit))).toBe('NotAllowed')
    expect(await value(run(signedIn, Assistant.latestOf(undefined)))).not.toHaveProperty('proposal')
    await asking.end()
    // A Turn started at home never reaches her System.
    const home = await bobsTurn(bobStar, 'apply')
    expect(refusal(await call(home.client, 'open_tile', { id: journal.id }))).toBe('TileNotFound')
    await home.end()
  })

  it('reaches nothing more once Ana takes *@* back, from its next call', async () => {
    const { ana, journal } = await shared('read+write+@')
    const { client, end } = await bobsTurn(journal.id, 'apply')
    expect(await call(client, 'open_tile', { id: journal.id })).toMatchObject({
      value: { tile: { title: 'Journal' } },
    })
    const toBob = { _tag: 'Account', star: (await bob).star } as const
    await value(
      run(
        ana.signedIn,
        Mapping.setGrant({ tile: journal.id, subject: toBob, value: 'read+write' }),
      ),
    )
    expect(refusal(await call(client, 'open_tile', { id: journal.id }))).toBe('TileNotFound')
    expect(
      refusal(await call(client, 'edit_tile', { id: journal.id, version: 1, title: 'Ours' })),
    ).toBe('TileNotFound')
    await end()
  })
})

describe('a Turn’s writes in someone else’s System, by its Mode', () => {
  it('writes in apply as Bob’s agent, told in both timelines, Ana’s offering its Undo', async () => {
    const { ana, journal } = await shared('read+write+@')
    const { signedIn } = await bob
    const { client, end } = await bobsTurn(journal.id, 'apply')
    const edited = await call(client, 'edit_tile', { id: journal.id, version: 1, title: 'Ours' })
    expect(edited).toMatchObject({ value: { title: 'Ours', version: 2 } })
    await end()
    const [receipt] = theirs(await told(ana.signedIn, (entries) => theirs(entries).length > 0))
    expect(receipt).toMatchObject({
      verb: 'TileEdited',
      tile: { id: journal.id, title: 'Ours' },
      actor: { _tag: 'Someone', star: 'Bob Martin', by: { _tag: 'Assistant' } },
      undone: false,
    })
    const own = await told(signedIn, (entries) =>
      entries.some((entry) => entry._tag === 'Change' && entry.tile.id === journal.id),
    )
    expect(
      own.find((entry) => entry._tag === 'Change' && entry.tile.id === journal.id),
    ).toMatchObject({ actor: { _tag: 'Assistant' }, elsewhere: true })
    // Bob's Turn changed nothing of his own: it offers no Undo of its own.
    expect(own.some((entry) => entry._tag === 'TurnApplied')).toBe(false)
    if (receipt === undefined) return
    await value(run(ana.signedIn, Proposal.undo({ applied: receipt.id })))
    const undone = await value(run(ana.signedIn, Mapping.system))
    expect(undone.tiles[journal.id]).toMatchObject({ title: 'Journal' })
  })

  it('drafts in ask over Ana’s System, accepted there as he may write, her Undo each', async () => {
    const { ana, journal } = await shared('read+write+@')
    const { signedIn } = await bob
    const { client, end } = await bobsTurn(journal.id, 'ask')
    const drafted = await call(client, 'create_tile', {
      parent: journal.id,
      slot: 2,
      ...content('Note'),
    })
    expect(drafted).toMatchObject({ value: { title: 'Note' } })
    // His reads show it; her System holds none of it yet.
    expect(await call(client, 'map', { id: journal.id, depth: 1 })).toMatchObject({
      value: { tile: { branches: { 2: { title: 'Note' } } } },
    })
    const before = await value(run(ana.signedIn, Mapping.system))
    expect(Object.values(before.tiles).map(({ id }) => id)).not.toContain(
      (drafted as { value: { id: string } }).value.id,
    )
    await end()
    const { proposal } = await value(run(signedIn, Assistant.latestOf(undefined)))
    if (proposal === undefined) return expect.fail('No Proposal was opened')
    // The poll and the day say whose System it changes, so the canvas draws it over hers.
    expect(proposal).toMatchObject({ drafts: 1, elsewhere: ana.star })
    const { proposal: drawn } = await value(run(signedIn, Assistant.conversationDay({ offset: 0 })))
    expect(drawn).toMatchObject({ id: proposal.id, elsewhere: ana.star, writes: [{}] })
    await value(run(signedIn, Proposal.acceptProposal({ proposal: proposal.id })))
    const after = await value(run(ana.signedIn, Mapping.system))
    expect(after.tiles[(drafted as { value: { id: string } }).value.id]).toMatchObject({
      title: 'Note',
    })
    expect(
      theirs((await value(run(ana.signedIn, Assistant.conversationDay({ offset: 0 })))).entries),
    ).toMatchObject([
      {
        verb: 'TileCreated',
        undone: false,
        actor: { _tag: 'Someone', star: 'Bob Martin', by: { _tag: 'You' } },
      },
    ])
    // His own timeline tells it as his, made elsewhere: he decided it, his agent only drafted it.
    const own = await told(signedIn, (entries) =>
      entries.some((entry) => entry._tag === 'Change' && entry.verb === 'TileCreated'),
    )
    expect(
      own.find((entry) => entry._tag === 'Change' && entry.verb === 'TileCreated'),
    ).toMatchObject({ actor: { _tag: 'You' }, elsewhere: true })
    // His Proposal offers no Undo: the owner holds it.
    expect(await run(signedIn, Proposal.undo({ applied: proposal.id }))).toMatchObject({
      ok: false,
      failure: { _tag: 'NothingToUndo' },
    })
  })

  it('drafts nothing into a Proposal over another System', async () => {
    const { journal } = await shared('read+write+@')
    const { signedIn, star: bobStar } = await bob
    const home = await bobsTurn(bobStar, 'ask')
    expect(
      await call(home.client, 'create_tile', { parent: bobStar, slot: 3, ...content('Mine') }),
    ).toMatchObject({ value: { title: 'Mine' } })
    await home.end()
    const there = await bobsTurn(journal.id, 'ask')
    expect(
      refusal(
        await call(there.client, 'create_tile', { parent: journal.id, slot: 2, ...content('No') }),
      ),
    ).toBe('ProposalElsewhere')
    await there.end()
    const { proposal } = await value(run(signedIn, Assistant.latestOf(undefined)))
    if (proposal === undefined) return expect.fail('The Proposal at home is gone')
    expect(proposal.drafts).toBe(1)
    expect(proposal).not.toHaveProperty('elsewhere')
    await value(run(signedIn, Proposal.discardProposal({ proposal: proposal.id })))
  })
})
