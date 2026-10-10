import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { type Entry, linkTo } from '#/domains/assistant/entities'
import { settings } from '#/domains/assistant/settings'
import * as Iam from '#/domains/iam/iam'
import { Sandbox } from '#/repositories/agent/sandbox/sandbox'
import {
  everyTurnSpent,
  startedAt,
  turnKeyKept,
  startedIn,
} from '#/repositories/database/conversations/testing'

import * as Assistant from '../../assistant/programs'
import * as Mapping from '../../mapping/programs'
import { value } from '../mcp/testing'
import { noSession, provenKey, run, type StartContext } from '../run'
import { doorsServed, signedUpAt } from './testing'

// A Turn on the fakes, end to end: a Message sent from home starts it, its System written into the
// sandbox on this machine, its launcher started there with the fake agent in Claude Code's place, the
// fake agent writing a Tile through `/mcp` and answering, each line it says posted to the events door,
// all three doors served over HTTP on this machine as a deployment serves them; a Stop interrupting it;
// a lost Turn ended by its time once the next starts; its refusals; and its Key revoked however it
// ended. `vitest.config.ts` sets the fake agent's pace to none. No test reaches Blaxel or Anthropic.

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

/** Today's Entries, as the chat reads them. */
const today = async (signedIn: StartContext) =>
  (await value(run(signedIn, Assistant.conversationDay({ offset: 0 })))).entries

/** What the page's poll sees running. */
const live = async (signedIn: StartContext) => (await value(run(signedIn, Assistant.latest))).turn

/** Waits for the Turn running to end, as the page's poll sees it. */
const ended = (signedIn: StartContext) =>
  until(async () => ((await live(signedIn)) === undefined ? true : undefined), 'ended')

/** Whether a Turn's Key is still kept. */
const keyKept = (signedIn: StartContext, turnId: string) =>
  value(run(signedIn, turnKeyKept(turnId)))

/** Sends a Message from home, its view centered on `center`, and answers what the post answered. */
async function send(text: string, center?: string) {
  const { signedIn, root } = await account
  const view = { center: center ?? root.id, shown: [root.id] }
  return run(signedIn, Assistant.sendMessage({ text, view, offset: 0 }))
}

/** What a Change says, in a few words: who did what to which Tile. */
const changeOf = (entry: Entry | undefined) =>
  entry?._tag === 'Change' ? `${entry.actor._tag} ${entry.verb} ${entry.tile.title}` : undefined

describe('a Turn on every Message', () => {
  it('starts on a Message, its agent writing through the MCP and answering, followed to its end', async () => {
    const { signedIn, accountId, waited } = await account
    const sent = await value(send('Draft a Tile for me.'))
    expect(sent.turn).toBeDefined()
    await waited()
    await ended(signedIn)

    const entries = await today(signedIn)
    const said = entries.flatMap((entry) =>
      entry._tag === 'Message' ? [`${entry.author}: ${entry.text}`] : [],
    )
    expect(said).toEqual([
      'user: Draft a Tile for me.',
      'agent: Let me look at where you are: the System folder.',
      expect.stringMatching(/^agent: I added "Drafted by the Assistant" under /) as string,
    ])
    expect(entries.map(changeOf).filter((told) => told !== undefined)).toEqual([
      'Assistant TileCreated Drafted by the Assistant',
    ])
    expect(entries.some(({ _tag }) => _tag === 'TurnEnded')).toBe(false)
    const system = await value(run(signedIn, Mapping.system))
    expect(
      Object.values(system.tiles).map((tile) => ('title' in tile ? tile.title : undefined)),
    ).toContain('Drafted by the Assistant')
    expect(await keyKept(signedIn, sent.turn?.id ?? '')).toBe(false)

    const box = await value(
      run(
        signedIn,
        Sandbox.use((sandbox) => sandbox.ensure(accountId)),
      ),
    )
    const prompt = await readFile(join(box.home, `turns/${sent.turn?.id ?? ''}/prompt.md`), 'utf8')
    expect(prompt).toContain('User: "Draft a Tile for me."')
    expect(prompt).not.toMatch(/hft_/)
    const settings = await readFile(
      join(box.home, `turns/${sent.turn?.id ?? ''}/turn.json`),
      'utf8',
    )
    expect(settings).not.toMatch(/hft_/)
    // The agent's HOME was the Turn's own, nothing else left in the work folder.
    expect(await readdir(join(box.home, 'work'))).toEqual([`turn-${sent.turn?.id ?? ''}`])
  })

  it('stops on a Stop: its agent interrupted, the timeline saying so, its Key revoked', async () => {
    const { signedIn, accountId, waited } = await account
    const sent = await value(send('Go slowly, please.'))
    await waited()
    await until(async () => (await live(signedIn))?.step, 'stepped')
    expect(await send('And another thing.')).toMatchObject({
      ok: false,
      failure: { _tag: 'TurnRunning' },
    })

    await value(run(signedIn, Assistant.stopTurn))
    expect(await live(signedIn)).toBeUndefined()
    await waited()
    expect((await today(signedIn)).at(-1)).toMatchObject({ _tag: 'TurnEnded', how: 'stopped' })
    expect(await keyKept(signedIn, sent.turn?.id ?? '')).toBe(false)
    const box = await value(
      run(
        signedIn,
        Sandbox.use((sandbox) => sandbox.ensure(accountId)),
      ),
    )
    const status = await value(run(signedIn, box.status(`turn-${sent.turn?.id ?? ''}`)))
    expect(status).toMatchObject({ _tag: 'Some', value: { state: 'stopped' } })
    expect(await value(run(signedIn, Assistant.stopTurn))).toBeNull()
  })

  it('stops an agent whose Turn a Stop ended while it was starting', async () => {
    const { signedIn, accountId, waited } = await account
    const sent = await value(send('Slowly, if you start at all.'))
    // The Stop lands before the agent started: it finds nothing to stop yet.
    await value(run(signedIn, Assistant.stopTurn))
    await waited()
    const box = await value(
      run(
        signedIn,
        Sandbox.use((sandbox) => sandbox.ensure(accountId)),
      ),
    )
    const status = await value(run(signedIn, box.status(`turn-${sent.turn?.id ?? ''}`)))
    expect(status).toMatchObject({ _tag: 'Some' })
    expect(status).not.toMatchObject({ value: { state: 'running' } })
    expect((await today(signedIn)).at(-1)).toMatchObject({ _tag: 'TurnEnded', how: 'stopped' })
  })

  it('ends a lost Turn by its time once the next one starts, its Key revoked', async () => {
    const { signedIn, waited } = await account
    const lost = await value(send('Go slowly again.'))
    await waited()
    const lostId = lost.turn?.id ?? ''
    // Its deadline passed: it started sixteen minutes ago, and nothing ended it.
    await value(run(signedIn, startedAt(lostId, new Date(Date.now() - 16 * 60_000))))
    expect(await live(signedIn)).toBeUndefined()
    const next = await value(send('Are you there?'))
    await waited()
    expect(await keyKept(signedIn, lostId)).toBe(false)
    const entries = await today(signedIn)
    expect(
      entries.find((entry) => entry._tag === 'TurnEnded' && entry.how === 'time'),
    ).toBeDefined()
    await ended(signedIn)
    expect(await keyKept(signedIn, next.turn?.id ?? '')).toBe(false)
  })

  it('ends by its sandbox when its agent could not start, its Key revoked', async () => {
    const { signedIn, waited } = await account
    // The request reached the app at no URL a sandbox could reach it at: writing its System fails.
    const nowhere = { ...signedIn, exchange: { ...signedIn.exchange, url: 'nowhere' } }
    const sent = await value(
      run(nowhere, Assistant.sendMessage({ text: 'Hello?', view: await viewAtRoot(), offset: 0 })),
    )
    await waited()
    expect(await live(signedIn)).toBeUndefined()
    expect((await today(signedIn)).at(-1)).toMatchObject({ _tag: 'TurnEnded', how: 'sandbox' })
    expect(await keyKept(signedIn, sent.turn?.id ?? '')).toBe(false)
  })
})

describe('a Turn at a Tile its Message links', () => {
  it('runs in the folder of the Tile a Message opens with a link to, the others its links pointed at', async () => {
    const { signedIn, accountId, root, waited } = await account
    // Two Tiles below the Root, far from the center: Work, in its last slot, then Team under it.
    const tile = async (parent: string, slot: 2 | 6, title: string) => {
      const id = crypto.randomUUID()
      const content = { id, parent, slot, title, preview: '', body: '' }
      await value(run(signedIn, Mapping.createTile(content)))
      return id
    }
    const work = await tile(root.id, 6, 'Work')
    const team = await tile(work, 2, 'Team')
    const gone = crypto.randomUUID()
    await waited()

    const text = `${linkTo(team)} tidy this, as ${linkTo(work)} and ${linkTo(gone)} say`
    const sent = await value(send(text))
    await waited()
    await ended(signedIn)
    expect(await value(run(signedIn, startedIn(sent.turn?.id ?? '')))).toBe(team)

    const entries = await today(signedIn)
    const said = entries.flatMap((entry) =>
      entry._tag === 'Message' && entry.author === 'agent' ? [entry.text] : [],
    )
    expect(said.slice(-2)).toEqual([
      expect.stringMatching(/^Let me look at where you are: 6-[\w-]+\/2-[\w-]+\.$/) as string,
      'I added "Drafted by the Assistant" under Team.',
    ])

    const box = await value(
      run(
        signedIn,
        Sandbox.use((sandbox) => sandbox.ensure(accountId)),
      ),
    )
    const prompt = await readFile(join(box.home, `turns/${sent.turn?.id ?? ''}/prompt.md`), 'utf8')
    expect(prompt).toMatch(/You start in "Team" \(id "[\w-]+"\), "6-[\w-]+\/2-[\w-]+"\./)
    expect(prompt).toMatch(
      /- "Team" \(id "[\w-]+"\): "6-[\w-]+\/2-[\w-]+\/CLAUDE.md" from the System folder, "CLAUDE.md" from where you start\./,
    )
    expect(prompt).toMatch(
      /- "Work" \(id "[\w-]+"\): "6-[\w-]+\/CLAUDE.md" from the System folder, "..\/CLAUDE.md" from where you start\./,
    )
    expect(prompt).toContain(`- A Tile deleted since (id "${gone}"): no longer in the System.`)
  })

  it('starts none at a linked Tile the Account’s System does not hold, nothing posted', async () => {
    const { signedIn } = await account
    const before = (await today(signedIn)).length
    expect(await send(`${linkTo(crypto.randomUUID())} over there`)).toMatchObject({
      ok: false,
      failure: { _tag: 'TileNotFound' },
    })
    expect(await today(signedIn)).toHaveLength(before)
  })
})

/** Home's view on the Root. */
const viewAtRoot = async () => {
  const { root } = await account
  return { center: root.id, shown: [root.id] }
}

describe("a Turn's refusals", () => {
  it('keeps the Message of an Account without the Assistant, and starts no Turn', async () => {
    const { origin } = await served
    const stranger = await signedUpAt(origin, `${crypto.randomUUID()}@example.com`)
    const { root } = await value(run(stranger.signedIn, Mapping.system))
    const view = { center: root.id, shown: [] }
    const sent = await value(
      run(stranger.signedIn, Assistant.sendMessage({ text: 'Anyone?', view, offset: 0 })),
    )
    expect(sent).not.toHaveProperty('turn')
    expect((await today(stranger.signedIn)).map(({ _tag }) => _tag)).toEqual(['Message'])
    expect(await live(stranger.signedIn)).toBeUndefined()
  })

  it('starts none at a Tile the Account’s System does not hold, nothing posted', async () => {
    const { signedIn } = await account
    const before = (await today(signedIn)).length
    expect(await send('Over there.', crypto.randomUUID())).toMatchObject({
      ok: false,
      failure: { _tag: 'TileNotFound' },
    })
    expect(await today(signedIn)).toHaveLength(before)
  })

  it('starts none from a Key: only a Session sends a Message', async () => {
    const { signedIn } = await account
    const { secret } = await value(run(signedIn, Iam.issueKey('script')))
    const exchange = {
      url: signedIn.exchange.url,
      headers: new Headers({ authorization: `Bearer ${secret}` }),
      setCookies: () => undefined,
    }
    const byKey: StartContext = {
      ...signedIn,
      exchange,
      session: noSession,
      key: await provenKey(exchange),
    }
    const view = await viewAtRoot()
    expect(await run(byKey, Assistant.sendMessage({ text: 'Me.', view, offset: 0 }))).toMatchObject(
      { ok: false, failure: { _tag: 'SessionRequired' } },
    )
  })

  it("starts none once the month's allowance is spent, nothing posted", async () => {
    const { signedIn, accountId } = await account
    // The Turns this month spent all there is.
    await value(run(signedIn, everyTurnSpent(accountId, settings.month.allowance)))
    const before = (await today(signedIn)).length
    expect(await send('One more?')).toMatchObject({
      ok: false,
      failure: { _tag: 'AllowanceSpent', kind: 'Forbidden' },
    })
    expect(await today(signedIn)).toHaveLength(before)
  })
})
