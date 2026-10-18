import { Effect, Exit, Option, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import type { KeyProof, Session } from '#/domains/iam/iam'
import { transactional } from '#/repositories/database/database'
import type { GrantRow } from '#/repositories/database/tiles/grants'
import { granted } from '#/repositories/database/tiles/testing'

import { noKey, run, type StartContext } from '../server/run'
import { GrantChange } from '#/domains/mapping/entities'

import { StarSearch, SystemRead, TileReach, TileVisit } from './mapping'
import * as Service from '#/domains/mapping/mapping'

import * as Mapping from './programs'

// Another Account's System, read through Mapping's programs as the server functions and the MCP run
// them, over PGlite: `system` naming a star, and `readTile` and `openTile` reading from a Tile of the
// System holding it, each as the Account may see it, a Turn's Key never past its own System; where a
// link to a Tile leads (`visit`), and the Titles a timeline names across Systems (Mapping's `titlesAcross`);
// who reaches a Tile, set and read by its owner from a Session alone (`setGrant`, `whoReaches`); and a
// star found by its Title or by a link (`findStars`, `starOfLink`).

/** How a request is proven: by a Session, by an Account's Key, or by a Turn's Key. */
type Proof = 'session' | 'key' | 'turn key'

/** A request from this Account, proven so. */
function request(account: { id: string; email: string }, proof: Proof = 'session'): StartContext {
  const session: Session = { account, expiresAt: new Date(Date.now() + 60_000) }
  const by: KeyProof['by'] =
    proof === 'turn key'
      ? { _tag: 'TurnKey', turnId: crypto.randomUUID() }
      : { _tag: 'Key', keyId: 'k' }
  return {
    requestId: 'req-seen',
    scope: 'test',
    waitUntil: () => undefined,
    exchange: {
      url: 'http://localhost/_serverFn',
      headers: new Headers(),
      setCookies: () => undefined,
    },
    session: Exit.succeed(proof === 'session' ? Option.some(session) : Option.none()),
    key: proof === 'session' ? noKey : Exit.succeed(Option.some({ account, by })),
  }
}

/** A request nothing proves. */
const signedOut = (): StartContext => ({
  ...request(someone()),
  session: Exit.succeed(Option.none()),
})

/** Someone no other test is, by a Session unless said otherwise. */
const someone = () => ({ id: crypto.randomUUID(), email: 'someone@example.com' })

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** The value of a call that must succeed. */
async function value<A>(outcome: Promise<{ ok: true; value: A } | { ok: false }>): Promise<A> {
  const settled = await outcome
  if (!settled.ok) throw new Error(`Expected a success, got ${JSON.stringify(settled)}`)
  return settled.value
}

/**
 * Ana's System: her star, `Journal` and `Garden` below it; Bob reads `Garden` by a Grant to his
 * Account, nothing else.
 */
async function anasSystem() {
  const ana = someone()
  const bob = someone()
  const asAna = request(ana)
  const { root } = await value(run(asAna, Mapping.system))
  const create = (title: string, slot: 1 | 2) =>
    value(run(asAna, Mapping.createTile({ parent: root.id, slot, ...content(title) })))
  const journal = await create('Journal', 1)
  const garden = await create('Garden', 2)
  const toBob: GrantRow = { tile: garden.id, subject: 'account', subjectId: bob.id, value: 'read' }
  await value(run(asAna, transactional(granted(ana.id, toBob))))
  return { ana, bob, star: root.id, journal, garden }
}

const notFound = { ok: false, failure: { _tag: 'TileNotFound', kind: 'NotFound' } }

describe('a System named by its star, as the Account may see it', () => {
  it('reads another’s System from its card to what a Grant lets it read, and its own by default', async () => {
    const { bob, star, journal, garden } = await anasSystem()
    const read = await value(run(request(bob), Mapping.systemAt(star)))
    expect(read.root).toMatchObject({ id: star, body: '' })
    expect(Object.keys(read.tiles)).toEqual([garden.id])
    expect(read.rights).toEqual({ [star]: [], [garden.id]: ['read'] })
    expect(JSON.stringify(read)).not.toContain(journal.id)
    const own = await value(run(request(bob), Mapping.systemAt(undefined)))
    expect(own.root.id).not.toBe(star)
    expect(own.rights[own.root.id]).toEqual(['read', 'write', '@'])
  })

  it('reads by a Turn’s Key no System but its own', async () => {
    const { bob, star } = await anasSystem()
    expect(await run(request(bob, 'turn key'), Mapping.systemAt(star))).toMatchObject(notFound)
    expect(await run(request(bob, 'turn key'), Mapping.system)).toMatchObject({ ok: true })
  })

  it('takes a star, a UUID, or nothing', () => {
    const accepts = (input: unknown) => Schema.is(SystemRead)(input)
    expect(accepts(undefined)).toBe(true)
    expect(accepts({ system: crypto.randomUUID() })).toBe(true)
    expect(accepts({ system: 'help' })).toBe(false)
    expect(accepts({})).toBe(false)
  })
})

describe('a read from a Tile, on the System holding it', () => {
  it('reads by an Account’s Key a Tile of another System a Grant lets it read, and no other', async () => {
    const { bob, journal, garden } = await anasSystem()
    const byKey = request(bob, 'key')
    const opened = await value(
      run(byKey, Mapping.openTile({ id: garden.id, fields: ['title', 'body'] })),
    )
    expect(opened.tile).toMatchObject({ id: garden.id, title: 'Garden', body: '# Garden' })
    // Its parent, the star, by its card's Title, which anyone sees.
    expect(opened.parent).toMatchObject({ title: '' })
    const mapped = await value(
      run(byKey, Mapping.readTile({ id: garden.id, depth: 1, fields: ['title'] })),
    )
    expect(mapped.tile).toMatchObject({ title: 'Garden' })
    for (const id of [journal.id, crypto.randomUUID()]) {
      expect(await run(byKey, Mapping.openTile({ id, fields: ['title'] }))).toMatchObject(notFound)
    }
    // Its own Root when no id is given.
    const own = await value(run(byKey, Mapping.openTile({ fields: ['title'] })))
    expect(own.parent).toBeNull()
  })

  it('reads by a Turn’s Key no Tile outside its own System, whatever its Account may read', async () => {
    const { bob, garden } = await anasSystem()
    const byTurn = request(bob, 'turn key')
    for (const program of [
      Mapping.openTile({ id: garden.id, fields: ['title'] }),
      Mapping.readTile({ id: garden.id, depth: 0, fields: ['title'] }),
    ]) {
      expect(await run(byTurn, program)).toMatchObject(notFound)
    }
    expect(
      await run(request(bob, 'key'), Mapping.openTile({ id: garden.id, fields: ['title'] })),
    ).toMatchObject({ ok: true })
    // Its own System, read as ever, by a Tile's id too.
    const { root } = await value(run(request(bob), Mapping.system))
    const mine = await value(
      run(request(bob), Mapping.createTile({ parent: root.id, slot: 1, ...content('Mine') })),
    )
    expect(
      await value(run(byTurn, Mapping.openTile({ id: mine.id, fields: ['title'] }))),
    ).toMatchObject({ tile: { title: 'Mine' } })
    expect(await run(byTurn, Mapping.openTile({ fields: ['title'] }))).toMatchObject({ ok: true })
  })
})

describe('a pin, a Reference to a Tile of another System, through the programs', () => {
  /** Bob's Root, read by his Session, at the Version a write to its Context slots names. */
  const bobsRoot = async (bob: { id: string; email: string }) =>
    (await value(run(request(bob), Mapping.system))).root

  it('pins by a Session or an Account’s Key a Tile a Grant lets the Account read, and no other', async () => {
    const { bob, journal, garden } = await anasSystem()
    const root = await bobsRoot(bob)
    const pin = (target: string, slot: -1 | -2, parentVersion: number) =>
      Mapping.createReference({ parent: root.id, parentVersion, slot, target })
    expect(await run(request(bob, 'key'), pin(garden.id, -1, root.version))).toMatchObject({
      ok: true,
    })
    // Journal, which Bob never read, is no Tile to him, as one that doesn't exist.
    expect(await run(request(bob), pin(journal.id, -2, root.version + 1))).toMatchObject(notFound)
    const own = await value(run(request(bob), Mapping.systemAt(undefined)))
    expect(Object.values(own.pinned)).toEqual([
      { id: garden.id, title: 'Garden', preview: 'Garden, in short.', starTitle: '' },
    ])
    expect(JSON.stringify(own)).not.toContain(journal.id)
  })

  it('shows a Turn’s Key a pin unavailable, its Tile outside the System it reads', async () => {
    const { bob, garden } = await anasSystem()
    const root = await bobsRoot(bob)
    const pin = Mapping.createReference({
      parent: root.id,
      parentVersion: root.version,
      slot: -1,
      target: garden.id,
    })
    await value(run(request(bob), pin))
    const opened = (proof: Proof) =>
      value(run(request(bob, proof), Mapping.openTile({ fields: ['title'] })))
    expect((await opened('key')).context[-1]).toMatchObject({
      _tag: 'Reference',
      tile: { id: garden.id, title: 'Garden' },
    })
    const byTurn = await opened('turn key')
    expect(byTurn.context[-1]).toEqual({ _tag: 'BrokenReference', target: '' })
    expect(JSON.stringify(byTurn)).not.toContain('Garden')
  })
})

describe('a link to a Tile, and the Titles a timeline names, across Systems', () => {
  it('leads to the System holding a Tile the Account may read, none for its own, nowhere past one kept from it', async () => {
    const { bob, star, journal, garden } = await anasSystem()
    const visit = (tile: string, proof?: Proof) => run(request(bob, proof), Mapping.visit({ tile }))
    expect(await value(visit(garden.id))).toEqual({ system: star })
    // The star itself, whose card anyone sees.
    expect(await value(visit(star))).toEqual({ system: star })
    // A Tile kept from Bob is no Tile at all to him.
    for (const tile of [journal.id, crypto.randomUUID()]) {
      expect(await visit(tile)).toMatchObject(notFound)
    }
    const { root } = await value(run(request(bob), Mapping.system))
    expect(await value(visit(root.id))).toEqual({})
    // A Turn's Key is led nowhere but its own System.
    expect(await visit(garden.id, 'turn key')).toMatchObject(notFound)
    expect(await value(visit(root.id, 'turn key'))).toEqual({})
  })

  it('takes a Tile by its UUID alone', () => {
    const accepts = (input: unknown) => Schema.is(TileVisit)(input)
    expect(accepts({ tile: crypto.randomUUID() })).toBe(true)
    expect(accepts({ tile: 'help' })).toBe(false)
    expect(accepts({})).toBe(false)
  })

  it('names a Tile of another System the Account may read, as it names its own, and none kept from it', async () => {
    const { bob, journal, garden } = await anasSystem()
    const { root } = await value(run(request(bob), Mapping.system))
    const mine = await value(
      run(request(bob), Mapping.createTile({ parent: root.id, slot: 1, ...content('Mine') })),
    )
    const gone = crypto.randomUUID()
    const titles = await value(
      run(
        request(bob),
        Effect.flatMap(Mapping.actingOnOwn(bob.id, { session: false }), (own) =>
          Service.titlesAcross(own, [garden.id, journal.id, mine.id, gone, garden.id]),
        ),
      ),
    )
    expect(titles).toEqual({ [garden.id]: 'Garden', [mine.id]: 'Mine' })
  })
})

describe('who reaches a Tile, set by its owner from a Session', () => {
  const everyone = { _tag: 'Everyone' } as const

  it('opens a Tile to Everyone, a stranger reading it, then lets it inherit again', async () => {
    const { ana, bob, star, journal } = await anasSystem()
    const stranger = someone()
    const set = (to: 'read' | 'none' | 'inherit') =>
      value(run(request(ana), Mapping.setGrant({ tile: journal.id, subject: everyone, value: to })))
    await set('read')
    expect(await value(run(request(ana), Mapping.whoReaches({ tile: journal.id })))).toEqual({
      everyone: { subject: everyone, value: 'read', from: journal.id },
      others: [],
    })
    const read = await value(run(request(stranger), Mapping.systemAt(star)))
    expect(Object.keys(read.tiles)).toEqual([journal.id])
    await set('inherit')
    const after = await value(run(request(stranger), Mapping.systemAt(star)))
    expect(Object.keys(after.tiles)).toEqual([])
    // Bob, who never read Journal, learns nothing of who does.
    expect(await run(request(bob), Mapping.whoReaches({ tile: journal.id }))).toMatchObject(
      notFound,
    )
  })

  it('refuses a Key, a Turn’s Key, anyone but the owner, and a signed-out call', async () => {
    const { ana, bob, journal, garden } = await anasSystem()
    const change = { tile: garden.id, subject: everyone, value: 'read' } as const
    for (const proof of ['key', 'turn key'] as const) {
      for (const program of [Mapping.setGrant(change), Mapping.whoReaches({ tile: garden.id })]) {
        expect(await run(request(ana, proof), program)).toMatchObject({
          ok: false,
          failure: { _tag: 'SessionRequired' },
        })
      }
    }
    // Bob reads Garden by his Grant, and changes nothing of who else does.
    expect(await run(request(bob), Mapping.setGrant(change))).toMatchObject({
      ok: false,
      failure: { _tag: 'NotAllowed' },
    })
    expect(
      await run(request(bob), Mapping.setGrant({ ...change, tile: journal.id })),
    ).toMatchObject(notFound)
    expect(await run(signedOut(), Mapping.setGrant(change))).toMatchObject({
      ok: false,
      failure: { _tag: 'SignedOut' },
    })
    // Bob's requests named his star, which names him in the list.
    const bobs = (await value(run(request(bob), Mapping.system))).root.id
    expect(await value(run(request(ana), Mapping.whoReaches({ tile: garden.id })))).toEqual({
      everyone: { subject: everyone, value: 'none', from: null },
      others: [
        {
          subject: { _tag: 'Account', id: bob.id },
          value: 'read',
          from: garden.id,
          star: { id: bobs, title: '', preview: '' },
        },
      ],
    })
  })

  it('shares with someone by their star, nobody else, and a star that names nothing with nobody', async () => {
    const { ana, bob, star, garden } = await anasSystem()
    const bobs = await value(run(request(bob), Mapping.system))
    const toBob = { tile: garden.id, subject: { _tag: 'Account', star: bobs.root.id } } as const
    await value(run(request(ana), Mapping.setGrant({ ...toBob, value: 'read+write' })))
    expect(await value(run(request(ana), Mapping.whoReaches({ tile: garden.id })))).toEqual({
      everyone: { subject: everyone, value: 'none', from: null },
      others: [
        {
          subject: { _tag: 'Account', id: bob.id },
          value: 'read+write',
          from: garden.id,
          star: { id: bobs.root.id, title: '', preview: '' },
        },
      ],
    })
    // Bob, who reads and writes Garden, shares it with nobody, himself included.
    expect(await run(request(bob), Mapping.setGrant({ ...toBob, value: 'read' }))).toMatchObject({
      ok: false,
      failure: { _tag: 'NotAllowed' },
    })
    const nobody = { _tag: 'Account', star: crypto.randomUUID() } as const
    expect(
      await run(
        request(ana),
        Mapping.setGrant({ tile: garden.id, subject: nobody, value: 'read' }),
      ),
    ).toMatchObject(notFound)
    const own = { _tag: 'Account', star } as const
    expect(
      await run(request(ana), Mapping.setGrant({ tile: garden.id, subject: own, value: 'read' })),
    ).toMatchObject({ ok: false, failure: { _tag: 'NotAllowed' } })
  })

  it('takes Everyone’s read, none or inherit, someone’s any value by their star, on a Tile by its UUID', () => {
    const tile = crypto.randomUUID()
    const sets = (input: unknown) => Schema.is(GrantChange)(input)
    expect(sets({ tile, subject: everyone, value: 'inherit' })).toBe(true)
    expect(sets({ tile, subject: everyone, value: 'read+write' })).toBe(false)
    const star = crypto.randomUUID()
    expect(sets({ tile, subject: { _tag: 'Account', star }, value: 'read+write+@' })).toBe(true)
    expect(sets({ tile, subject: { _tag: 'Account', id: star }, value: 'read' })).toBe(false)
    expect(sets({ tile: 'help', subject: everyone, value: 'read' })).toBe(false)
    expect(Schema.is(TileReach)({ tile })).toBe(true)
    expect(Schema.is(TileReach)({ tile: 'help/3' })).toBe(false)
  })
})

describe('a star found by its Title or by a link, for the star picker', () => {
  /** Ana's System, her star titled with a word no other test's Titles hold, and Journal below it. */
  async function anaTitled() {
    const system = await anasSystem()
    const word = `w${crypto.randomUUID().slice(0, 8)}`
    const title = `Ana ${word}`
    await value(
      run(
        request(system.ana),
        Mapping.editTile({ id: system.star, version: 1, title, preview: 'Gardens.' }),
      ),
    )
    await value(
      run(
        request(system.ana),
        Mapping.editTile({ id: system.journal.id, version: 1, title: `Journal ${word}` }),
      ),
    )
    return { ...system, word, card: { id: system.star, title, preview: 'Gardens.' } }
  }

  it('finds another’s star by its card, private as it is, never a Tile below, nor its own', async () => {
    const { ana, bob, word, card } = await anaTitled()
    expect(await value(run(request(bob), Mapping.findStars({ query: word })))).toEqual([card])
    expect(await value(run(request(ana), Mapping.findStars({ query: word })))).toEqual([])
    expect(await run(signedOut(), Mapping.findStars({ query: word }))).toMatchObject({
      ok: false,
      failure: { _tag: 'SignedOut' },
    })
  })

  it('takes a query trimmed, long enough to search, never too long', () => {
    const accepts = (query: string) => Schema.is(StarSearch)({ query })
    expect(accepts('An')).toBe(true)
    expect(accepts('A')).toBe(false)
    expect(accepts(' Ana')).toBe(false)
    expect(accepts('a'.repeat(101))).toBe(false)
  })

  it('leads a link to the star of a Tile the Account is shown, its own as its own, nowhere past one kept from it', async () => {
    const { bob, star, journal, garden, card } = await anaTitled()
    const linked = (tile: string, proof?: Proof) =>
      value(run(request(bob, proof), Mapping.starOfLink({ tile })))
    // Garden, by Bob's Grant, and her star, whose card anyone sees.
    expect(await linked(garden.id)).toEqual({ _tag: 'Star', star: card })
    expect(await linked(star)).toEqual({ _tag: 'Star', star: card })
    // Journal, kept from Bob, is no Tile at all to him, as one no System holds.
    for (const tile of [journal.id, crypto.randomUUID()]) {
      expect(await linked(tile)).toEqual({ _tag: 'Nowhere' })
    }
    const { root } = await value(run(request(bob), Mapping.system))
    expect(await linked(root.id)).toEqual({ _tag: 'Own' })
    // A Turn's Key is led nowhere outside its own System.
    expect(await linked(garden.id, 'turn key')).toEqual({ _tag: 'Nowhere' })
    expect(await run(signedOut(), Mapping.starOfLink({ tile: garden.id }))).toMatchObject({
      ok: false,
      failure: { _tag: 'SignedOut' },
    })
  })
})
