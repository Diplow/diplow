import { Exit, Option } from 'effect'
import { describe, expect, it } from 'vitest'

import type { Session } from '#/domains/iam/iam'

import * as Mapping from '../../mapping/programs'
import { noKey, run, type StartContext } from '../run'
import { markdownLink, servePublicTile } from './public'

// A public Tile read by anyone holding its link, over PGlite, through the programs and the door:
// `publicSystem`, what `/t/<id>` draws signed out, and `/t/<id>.md`, its Markdown, each for a Tile
// Everyone may read, and the same 404 for one kept from Everyone, one set to none below a public one,
// and one that doesn't exist. The Markdown's own format is `markdown.test.ts`'s.

const everyone = { _tag: 'Everyone' } as const
const origin = 'http://localhost'

/** A request from this Account, proven by a Session; or, without one, a request nothing proves. */
function request(account?: { id: string; email: string }): StartContext {
  const session: Option.Option<Session> =
    account === undefined
      ? Option.none()
      : Option.some({ account, expiresAt: new Date(Date.now() + 60_000) })
  return {
    requestId: 'req-public',
    scope: 'test',
    waitUntil: () => undefined,
    exchange: { url: `${origin}/_serverFn`, headers: new Headers(), setCookies: () => undefined },
    session: Exit.succeed(session),
    key: noKey,
  }
}

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** The value of a call that must succeed. */
async function value<A>(outcome: Promise<{ ok: true; value: A } | { ok: false }>): Promise<A> {
  const settled = await outcome
  if (!settled.ok) throw new Error(`Expected a success, got ${JSON.stringify(settled)}`)
  return settled.value
}

/**
 * Ana's System: her star, `Journal` and `Garden` below it. `Garden` is open to Everyone, and below it
 * `Seeds` and `Shed`, a Leaf `Notes`, a Context Tile `Soil` and a Reference to `Journal` in its
 * Context; `Shed` is set to none, and `Tools` stands below it.
 */
async function anasSystem() {
  const ana = { id: crypto.randomUUID(), email: 'ana@example.com' }
  const asAna = request(ana)
  const { root } = await value(run(asAna, Mapping.system))
  const create = (title: string, parent: string, slot: 1 | 2 | -1 | { leaf: 1 }) =>
    value(run(asAna, Mapping.createTile({ parent, slot, ...content(title) })))
  const journal = await create('Journal', root.id, 1)
  const garden = await create('Garden', root.id, 2)
  const seeds = await create('Seeds', garden.id, 1)
  const shed = await create('Shed', garden.id, 2)
  const tools = await create('Tools', shed.id, 1)
  const notes = await create('Notes', garden.id, { leaf: 1 })
  const soil = await create('Soil', garden.id, -1)
  const opened = await value(run(asAna, Mapping.openTile({ id: garden.id, fields: ['title'] })))
  await value(
    run(
      asAna,
      Mapping.createReference({
        parent: garden.id,
        parentVersion: opened.tile.version,
        slot: -2,
        target: journal.id,
      }),
    ),
  )
  const share = (tile: string, to: 'read' | 'none') =>
    value(run(asAna, Mapping.setGrant({ tile, subject: everyone, value: to })))
  await share(garden.id, 'read')
  await share(shed.id, 'none')
  return { ana, star: root.id, journal, garden, seeds, shed, tools, notes, soil }
}

const notFound = { ok: false, failure: { _tag: 'TileNotFound', kind: 'NotFound' } }

/** `/t/<id>.md`, fetched as anyone fetches it. */
const fetched = (id: string, headers: HeadersInit = {}) =>
  servePublicTile(new Request(`${origin}/t/${id}.md`, { headers }), id)

describe('the System of a public Tile, as anyone sees it', () => {
  it('reads the System holding a public Tile, signed out, from its star’s card to what Everyone reads', async () => {
    const { star, journal, garden, seeds, shed, tools, notes, soil } = await anasSystem()
    for (const tile of [garden.id, seeds.id, notes.id]) {
      const seen = await value(run(request(), Mapping.publicSystem({ tile })))
      expect(seen.root).toMatchObject({ id: star, body: '' })
      const placed = Object.values(seen.tiles)
      expect(placed.flatMap((held) => (held._tag === 'Tile' ? [held.id] : [])).sort()).toEqual(
        [garden.id, seeds.id, notes.id, soil.id].sort(),
      )
      // Garden's Reference to Journal shows, unavailable, as one whose Tile was deleted would.
      expect(placed.filter((held) => held._tag === 'Reference')).toEqual([
        expect.objectContaining({ parent: garden.id, slot: -2, target: '' }),
      ])
      expect(seen.rights[garden.id]).toEqual(['read'])
      expect(seen.rights[star]).toEqual([])
      const said = JSON.stringify(seen)
      for (const kept of [journal.id, shed.id, tools.id]) expect(said).not.toContain(kept)
    }
  })

  it('answers TileNotFound for a Tile kept from Everyone, one set to none below a public one, and none', async () => {
    const { star, journal, shed, tools } = await anasSystem()
    for (const tile of [star, journal.id, shed.id, tools.id, crypto.randomUUID()]) {
      expect(await run(request(), Mapping.publicSystem({ tile }))).toMatchObject(notFound)
    }
  })

  it('reads as anyone would, whoever is signed in: Ana’s own Session reads no more of it', async () => {
    const { ana, journal, garden } = await anasSystem()
    const seen = await value(run(request(ana), Mapping.publicSystem({ tile: garden.id })))
    expect(JSON.stringify(seen)).not.toContain(journal.id)
    expect(seen.rights[garden.id]).toEqual(['read'])
    expect(await run(request(ana), Mapping.publicSystem({ tile: journal.id }))).toMatchObject(
      notFound,
    )
  })
})

describe('/t/<id>.md', () => {
  it('writes a public Frame as Markdown, its Children and Context linked, nothing kept from Everyone', async () => {
    const { journal, garden, seeds, shed, notes, soil } = await anasSystem()
    const answer = await fetched(garden.id)
    expect(answer.status).toBe(200)
    expect(answer.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(answer.headers.get('x-robots-tag')).toBe('noindex')
    expect(answer.headers.get('cache-control')).toBe('no-store')
    const link = markdownLink(`${origin}/t/${garden.id}.md`)
    expect(await answer.text()).toBe(
      [
        '# Garden',
        'Garden, in short.',
        '# Garden',
        `## Children\n\n- [Seeds](${link(seeds.id)}): Seeds, in short.\n- [Notes](${link(notes.id)}): Notes, in short.`,
        `## Context\n\n- [Soil](${link(soil.id)}): Soil, in short.`,
      ].join('\n\n') + '\n',
    )
    const said = await (await fetched(garden.id)).text()
    for (const kept of [journal.id, shed.id]) expect(said).not.toContain(kept)
  })

  it('serves each Tile it links the same way, so an LLM walks the public part of the System', async () => {
    const { seeds, notes, soil } = await anasSystem()
    for (const { id } of [seeds, notes, soil]) {
      const answer = await fetched(id)
      expect(answer.status).toBe(200)
      expect(await answer.text()).toMatch(/^# (Seeds|Notes|Soil)\n/)
    }
  })

  it('answers the same 404 for a Tile kept from Everyone, set to none below a public one, or none', async () => {
    const { star, journal, shed, tools } = await anasSystem()
    const missing = await fetched(crypto.randomUUID())
    expect(missing.status).toBe(404)
    const said = await missing.text()
    for (const id of [star, journal.id, shed.id, tools.id, 'help/1/1', 'helper', 'not-a-tile']) {
      const answer = await fetched(id)
      expect(answer.status).toBe(404)
      expect(answer.headers.get('x-robots-tag')).toBe('noindex')
      expect(await answer.text()).toBe(said)
    }
    // A cookie or a Key changes nothing: the door passes neither on, and reads as anyone.
    const proving = await fetched(journal.id, {
      cookie: 'session=any',
      authorization: 'Bearer any',
    })
    expect(proving.status).toBe(404)
  })
})
