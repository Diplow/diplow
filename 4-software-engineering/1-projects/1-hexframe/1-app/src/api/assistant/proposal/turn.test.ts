import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import type { Entry } from '#/domains/assistant/entities'
import { Sandbox } from '#/repositories/agent/sandbox/sandbox'

import * as Mapping from '../../mapping/programs'
import { doorsServed, signedUpAt } from '../../server/events/testing'
import { value } from '../../server/mcp/testing'
import { run, type StartContext } from '../../server/run'
import * as Assistant from '../programs'
import * as Proposal from './programs'

// A Turn in ask on the fakes, end to end, as `../../server/events/turn.test.ts` runs one in apply: the
// fake agent's write drafted into the Proposal through `/mcp`, the System untouched; the next Turn's
// files holding the Proposal folded over the System, its agent reading through it and adding to it;
// then the Proposal accepted from the Session, its writes landing as the user's. No test reaches
// Blaxel or Anthropic.

const served = doorsServed()

afterAll(async () => {
  await (await served).close()
})

const account = (async () => {
  const { origin } = await served
  const someone = await signedUpAt(origin, 'entitled@example.com')
  const { root } = await value(run(someone.signedIn, Mapping.system))
  return { ...someone, root }
})()

/** Waits until `done` answers something, a few seconds at most. */
async function until<A>(done: () => Promise<A | undefined>, what: string): Promise<A> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const found = await done()
    if (found !== undefined) return found
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Never ${what}`)
}

/** Sends a Message from home, centered on the Root, and waits for its Turn to end. */
async function answered(text: string) {
  const { signedIn, root, waited } = await account
  const view = { center: root.id, shown: [root.id] }
  const sent = await value(run(signedIn, Assistant.sendMessage({ text, view, offset: 0 })))
  await waited()
  await until(
    async () =>
      (await value(run(signedIn, Assistant.latestOf(undefined)))).turn === undefined
        ? true
        : undefined,
    'ended',
  )
  return sent
}

/** Today's Proposal Entries. */
const proposals = async (signedIn: StartContext) =>
  (await value(run(signedIn, Assistant.conversationDay({ offset: 0 })))).entries.filter(
    (entry): entry is Extract<Entry, { _tag: 'Proposal' }> => entry._tag === 'Proposal',
  )

/** Today's changes, who acted and their verb, once at least `count` are recorded, the bus waited for. */
async function changes(signedIn: StartContext, count: number) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const { entries } = await value(run(signedIn, Assistant.conversationDay({ offset: 0 })))
    const told = entries.flatMap((entry) =>
      entry._tag === 'Change' ? [`${entry.actor._tag} ${entry.verb}`] : [],
    )
    if (told.length >= count) return told
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Fewer than ${String(count)} Changes were recorded`)
}

/** The Titles of the System's Tiles below its Root, as a Session reads it. */
const titlesHeld = async (signedIn: StartContext) => {
  const { tiles } = await value(run(signedIn, Mapping.system))
  return Object.values(tiles).flatMap((held) => (held._tag === 'Tile' ? [held.title] : []))
}

const drafted = 'Drafted by the Assistant'

describe('a Turn in ask, on the fakes', () => {
  it('drafts its agent’s write into the Proposal, the System untouched', async () => {
    const { signedIn } = await account
    await answered('Draft a Tile for me.')
    const [proposal] = await proposals(signedIn)
    expect(proposal).toMatchObject({
      fate: 'open',
      changes: [{ verb: 'TileCreated', tile: { title: drafted } }],
    })
    expect(await titlesHeld(signedIn)).toEqual([])
  })

  it('starts the next Turn with the Proposal folded into its files, its agent adding to it', async () => {
    const { signedIn, accountId } = await account
    const sent = await answered('Another one.')
    const box = await value(
      run(
        signedIn,
        Sandbox.use((sandbox) => sandbox.ensure(accountId)),
      ),
    )
    const drafts = (await proposals(signedIn))[0]?.changes ?? []
    const first = drafts[0]?.tile.id ?? ''
    // The first draft sits in Direction 1 of the Root, as the Proposal makes the System.
    const file = await readFile(
      join(box.home, 'system/1-drafted-by-the-assistant/CLAUDE.md'),
      'utf8',
    )
    expect(file).toContain(`id: ${first}`)
    expect(sent.turn).toBeDefined()
    // The agent read the Root through the Proposal, found Direction 1 taken, and drafted in 2.
    expect(drafts.map(({ verb, tile }) => `${verb} ${tile.title}`)).toEqual([
      `TileCreated ${drafted}`,
      `TileCreated ${drafted}`,
    ])
    expect(await proposals(signedIn)).toHaveLength(1)
    expect(await titlesHeld(signedIn)).toEqual([])
  })

  it('lands whole once accepted, as yours', async () => {
    const { signedIn } = await account
    const [proposal] = await proposals(signedIn)
    await value(run(signedIn, Proposal.acceptProposal({ proposal: proposal?.proposal ?? '' })))
    expect(await titlesHeld(signedIn)).toEqual([drafted, drafted])
    expect((await proposals(signedIn))[0]?.fate).toBe('accepted')
    expect(await changes(signedIn, 2)).toEqual(['You TileCreated', 'You TileCreated'])
  })
})
