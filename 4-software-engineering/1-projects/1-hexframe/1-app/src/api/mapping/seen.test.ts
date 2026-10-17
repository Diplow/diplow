import { Effect, Exit, Option, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import type { KeyProof, Session } from '#/domains/iam/iam'
import { transactional } from '#/repositories/database/database'
import type { GrantRow } from '#/repositories/database/tiles/grants'
import { granted } from '#/repositories/database/tiles/testing'

import { noKey, run, type StartContext } from '../server/run'
import { SystemRead, TileVisit } from './mapping'
import * as Service from '#/domains/mapping/mapping'

import * as Mapping from './programs'

// Another Account's System, read through Mapping's programs as the server functions and the MCP run
// them, over PGlite: `system` naming a star, and `readTile` and `openTile` reading from a Tile of the
// System holding it, each as the Account may see it, a Turn's Key never past its own System; where a
// link to a Tile leads (`visit`), and the Titles a timeline names across Systems (Mapping's `titlesAcross`).

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
