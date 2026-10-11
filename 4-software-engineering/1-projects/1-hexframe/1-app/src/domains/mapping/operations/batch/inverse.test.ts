import { Result, Struct } from 'effect'
import { describe, expect, it } from 'vitest'

import { directions, type PlacedTile, type Slot, type System, tileAt } from '../../entities'
import {
  CreateReference,
  CreateTile,
  decide,
  DeleteReference,
  DeleteTile,
  EditTile,
  evolve,
  extended,
  inverse,
  MoveTile,
  type Operation,
  type OperationEvent,
  SwapTiles,
  type Undo,
  undoOf,
  whole,
} from '..'

// A batch's inverse, on Systems made by hand and on Systems and batches a seeded generator makes, no
// database: each Operation, then its inverse, gives the System back, its Tiles where and as they
// stood, a deleted one under its id with what it kept from its files; the inverse names the Versions
// the batch left, so a Tile changed since refuses it; and a batch that grows keeps one undo of all of
// it, outdated once a Tile it touched changed between two runs. That an undo runs over the database
// is `./batch.test.ts`'s.

const uuid = () => crypto.randomUUID()

const placed = (id: string, parent: string, slot: Slot, version = 1): PlacedTile => ({
  _tag: 'Tile',
  id,
  title: `Tile ${id.slice(0, 4)}`,
  preview: `${id.slice(0, 4)}, in short.`,
  body: `# ${id.slice(0, 4)}`,
  version,
  parent,
  slot,
})

const id = { root: uuid(), work: uuid(), team: uuid(), note: uuid(), home: uuid(), link: uuid() }

// The Root, Ada, holds Work in Direction 1, which holds Team and, in its Context, a Reference to
// Home; Home stands in Direction 2, and Team holds a Leaf, Note, imported under a Name of its own.
const system: System = {
  root: { _tag: 'Tile', id: id.root, title: 'Ada', preview: '', body: '', version: 3 },
  tiles: {
    [id.work]: placed(id.work, id.root, 1, 4),
    [id.team]: placed(id.team, id.work, 2, 2),
    [id.note]: { ...placed(id.note, id.team, { leaf: 1 }), name: 'NOTE.md' },
    [id.home]: placed(id.home, id.root, 2, 5),
    [id.link]: { _tag: 'Reference', id: id.link, parent: id.work, slot: -1, target: id.home },
  },
  owned: true,
  version: 20,
}

/**
 * A System as a reader sees it, its Versions aside, and a Reference broken already left out: what an
 * undo gives back.
 */
const said = (held: System) => ({
  root: Struct.omit(held.root, ['version']),
  tiles: Object.fromEntries(
    Object.entries(held.tiles).flatMap(([key, found]): ReadonlyArray<[string, object]> => {
      if (found._tag === 'Tile') return [[key, Struct.omit(found, ['version'])]]
      return tileAt(held, found.target) === undefined ? [] : [[key, found]]
    }),
  ),
})

/** The events an Operation makes on a System, which must apply, a create under its id or a fresh one. */
function eventsOf(on: System, operation: Operation): ReadonlyArray<OperationEvent> {
  const made = { id: (operation._tag === 'CreateTile' ? operation.id : undefined) ?? uuid() }
  return Result.getOrThrow(decide(on, operation, made))
}

/** A batch's events on a System, each Operation decided on what the ones before it made. */
function ran(on: System, ...operations: ReadonlyArray<(held: System) => Operation>) {
  let held = on
  const events: Array<OperationEvent> = []
  for (const operation of operations) {
    const made = eventsOf(held, operation(held))
    events.push(...made)
    held = made.reduce(evolve, held)
  }
  return { events, after: held }
}

/** The System an undo leaves, run whole where its batch left the System. */
const undone = (after: System, undo: Undo) => {
  if (undo._tag === 'Outdated') throw new Error('The undo is outdated')
  return Result.getOrThrow(whole(after, undo.batch)).system
}

/** The Version a System holds a Tile at. */
const versionOf = (held: System, tile: string) => tileAt(held, tile)?.version ?? 0

describe("inverse, a batch's undo", () => {
  const each: ReadonlyArray<[string, (held: System) => Operation]> = [
    ['a create', () => new CreateTile({ parent: id.work, slot: 3, ...content('New') })],
    [
      'an edit',
      (held) =>
        new EditTile({ id: id.team, version: versionOf(held, id.team), title: 'Crew', body: '' }),
    ],
    [
      'an edit of the Root',
      (held) => new EditTile({ id: id.root, version: versionOf(held, id.root), preview: 'Me.' }),
    ],
    [
      'a move',
      (held) =>
        new MoveTile({ id: id.team, version: versionOf(held, id.team), parent: id.root, slot: 4 }),
    ],
    [
      'a move to a Leaf slot',
      (held) =>
        new MoveTile({
          id: id.note,
          version: versionOf(held, id.note),
          parent: id.root,
          slot: { leaf: 2 },
        }),
    ],
    [
      'a swap',
      (held) =>
        new SwapTiles({
          a: id.team,
          aVersion: versionOf(held, id.team),
          b: id.home,
          bVersion: versionOf(held, id.home),
        }),
    ],
    [
      'a delete, everything below it',
      (held) => new DeleteTile({ id: id.work, version: versionOf(held, id.work) }),
    ],
    [
      'a Reference created',
      (held) =>
        new CreateReference({
          parent: id.team,
          parentVersion: versionOf(held, id.team),
          slot: -2,
          target: id.root,
        }),
    ],
    [
      'a Reference deleted',
      (held) =>
        new DeleteReference({ parent: id.work, parentVersion: versionOf(held, id.work), slot: -1 }),
    ],
  ]

  it.each(each)('undoes %s: the System as it stood, Versions aside', (_, operation) => {
    const { events, after } = ran(system, operation)
    expect(events.length).toBeGreaterThan(0)
    expect(said(undone(after, undoOf(system, events)))).toEqual(said(system))
  })

  it('makes a deleted Tile again under its id, with what it kept from its files, and its Reference', () => {
    const { events, after } = ran(
      system,
      (held) => new DeleteTile({ id: id.work, version: versionOf(held, id.work) }),
    )
    expect(tileAt(after, id.note)).toBeUndefined()
    const back = undone(after, undoOf(system, events))
    expect(tileAt(back, id.note)).toMatchObject({
      name: 'NOTE.md',
      parent: id.team,
      slot: { leaf: 1 },
    })
    expect(back.tiles[id.link]).toEqual(system.tiles[id.link])
  })

  it('undoes a batch, its last event first: a create, a child under it, then an edit of both', () => {
    const made = uuid()
    const { events, after } = ran(
      system,
      () => new CreateTile({ id: made, parent: id.root, slot: 3, ...content('Plans') }),
      () => new CreateTile({ parent: made, slot: 1, ...content('Q1') }),
      (held) => new EditTile({ id: made, version: versionOf(held, made), title: 'Roadmap' }),
      (held) =>
        new MoveTile({ id: id.home, version: versionOf(held, id.home), parent: made, slot: 2 }),
    )
    const undo = inverse(system, events)
    expect(undo.map(({ operation }) => operation._tag)).toEqual([
      'MoveTile',
      'EditTile',
      'DeleteTile',
      'DeleteTile',
    ])
    expect(said(undone(after, { _tag: 'Inverse', batch: undo }))).toEqual(said(system))
  })

  it('names the Versions the batch left, so a Tile changed since refuses the undo', () => {
    const { events, after } = ran(
      system,
      (held) => new EditTile({ id: id.team, version: versionOf(held, id.team), title: 'Crew' }),
    )
    const [edit] = inverse(system, events)
    expect(edit?.operation).toMatchObject({
      _tag: 'EditTile',
      version: versionOf(after, id.team),
      title: 'Tile ' + id.team.slice(0, 4),
    })
    const since = eventsOf(
      after,
      new EditTile({ id: id.team, version: versionOf(after, id.team), body: 'Later.' }),
    ).reduce(evolve, after)
    const refused = whole(since, inverse(system, events))
    expect(Result.isFailure(refused) && refused.failure._tag).toBe('BatchOutdated')
  })

  it("keeps the Root's name, which no edit takes back to nothing, and checks its Version all the same", () => {
    const untitled = { ...system, root: { ...system.root, title: '' } }
    const { events, after } = ran(
      untitled,
      (held) => new EditTile({ id: id.root, version: versionOf(held, id.root), title: 'Ada' }),
    )
    const undo = inverse(untitled, events)
    expect(undo).toEqual([
      { operation: new EditTile({ id: id.root, version: versionOf(after, id.root) }) },
    ])
  })

  it('puts a Reference back once the Tile it points at is made again, later in the undo', () => {
    const { events, after } = ran(
      system,
      (held) => new DeleteTile({ id: id.home, version: versionOf(held, id.home) }),
      (held) => new DeleteTile({ id: id.work, version: versionOf(held, id.work) }),
    )
    const back = undone(after, undoOf(system, events))
    expect(tileAt(back, id.home)).toBeDefined()
    expect(back.tiles[id.link]).toEqual(system.tiles[id.link])
  })

  it('leaves out a Reference broken before the batch, which no create can make', () => {
    const broken = { ...system, tiles: Struct.omit(system.tiles, [id.home]) }
    const { events, after } = ran(
      broken,
      (held) => new DeleteTile({ id: id.work, version: versionOf(held, id.work) }),
    )
    const back = undone(after, undoOf(broken, events))
    expect(tileAt(back, id.note)).toBeDefined()
    expect(back.tiles[id.link]).toBeUndefined()
  })
})

describe('extended, the undo of a batch that grows', () => {
  const edit = (title: string) => (held: System) =>
    new EditTile({ id: id.team, version: versionOf(held, id.team), title })

  it('undoes every run, the last first, its Versions as the System holds them once the later are undone', () => {
    const first = ran(
      system,
      edit('Crew'),
      (held) =>
        new MoveTile({ id: id.team, version: versionOf(held, id.team), parent: id.root, slot: 5 }),
    )
    const second = ran(
      first.after,
      edit('Squad'),
      (held) => new DeleteTile({ id: id.team, version: versionOf(held, id.team) }),
    )
    const undo = extended(undoOf(system, first.events), first.after, second.events)
    expect(said(undone(second.after, undo))).toEqual(said(system))
  })

  it('is outdated, for good, once a Tile an earlier run touched changed before the next one', () => {
    const first = ran(system, edit('Crew'))
    const meanwhile = ran(first.after, edit('Mine'))
    const second = ran(meanwhile.after, edit('Squad'))
    const outdated = extended(undoOf(system, first.events), meanwhile.after, second.events)
    expect(outdated).toEqual({ _tag: 'Outdated' })
    const third = ran(
      second.after,
      () => new CreateTile({ parent: id.root, slot: 6, ...content('Late') }),
    )
    expect(extended(outdated, second.after, third.events)).toEqual({ _tag: 'Outdated' })
  })

  it('is not outdated by a change to a Tile no run touched', () => {
    const first = ran(system, edit('Crew'))
    const meanwhile = ran(
      first.after,
      (held) => new EditTile({ id: id.home, version: versionOf(held, id.home), title: 'House' }),
    )
    const second = ran(meanwhile.after, edit('Squad'))
    const undo = extended(undoOf(system, first.events), meanwhile.after, second.events)
    const house = { ...placed(id.home, id.root, 2), title: 'House' }
    expect(said(undone(second.after, undo))).toEqual(
      said({ ...system, tiles: { ...system.tiles, [id.home]: house } }),
    )
  })
})

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** A seeded generator, so a failing batch is made again by its seed. */
function seeded(seed: number) {
  let state = seed
  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
  const pick = <T>(among: ReadonlyArray<T>): T => {
    const picked = among[Math.floor(next() * among.length)]
    if (picked === undefined) throw new Error('Nothing to pick')
    return picked
  }
  return { next, pick }
}

/** Any slot under a Tile: a Branch's, a Leaf's or a Context slot. */
const slots: ReadonlyArray<Slot> = [
  ...directions,
  ...directions.map((leaf) => ({ leaf })),
  -1,
  -2,
  -3,
]

/** An Operation a generator makes on a System: one `decide` may refuse, which a batch then leaves out. */
function anyOperation(held: System, { next, pick }: ReturnType<typeof seeded>): Operation {
  const tiles = [
    held.root.id,
    ...Object.values(held.tiles).flatMap((found) => (found._tag === 'Tile' ? [found.id] : [])),
  ]
  const tile = pick(tiles)
  const other = pick(tiles)
  const version = versionOf(held, tile)
  switch (Math.floor(next() * 7)) {
    case 0:
    case 1:
      return new CreateTile({
        parent: tile,
        slot: pick(slots),
        ...content(`T${String(Math.floor(next() * 100))}`),
      })
    case 2:
      return new EditTile({
        id: tile,
        version,
        ...(next() < 0.5 ? { title: 'Edited' } : { body: 'Edited.' }),
      })
    case 3:
      return new MoveTile({ id: tile, version, parent: other, slot: pick(slots) })
    case 4:
      return new SwapTiles({
        a: tile,
        aVersion: version,
        b: other,
        bVersion: versionOf(held, other),
      })
    case 5:
      return new CreateReference({
        parent: tile,
        parentVersion: version,
        slot: pick([-1, -2, -3] as const),
        target: other,
      })
    default:
      return next() < 0.5
        ? new DeleteTile({ id: tile, version })
        : new DeleteReference({
            parent: tile,
            parentVersion: version,
            slot: pick([-1, -2, -3] as const),
          })
  }
}

/** A System and a batch run over it, each Operation `decide` refuses left out. */
function generated(seed: number) {
  const random = seeded(seed)
  let held = system
  const grow = (count: number) => {
    const events: Array<OperationEvent> = []
    for (let made = 0; made < count; made++) {
      const decided = decide(held, anyOperation(held, random), { id: uuid() })
      if (Result.isFailure(decided)) continue
      events.push(...decided.success)
      held = decided.success.reduce(evolve, held)
    }
    return events
  }
  grow(20)
  const before = held
  const events = grow(15)
  return {
    before,
    events,
    after: held,
    more: () => ({ before: held, events: grow(10), after: held }),
  }
}

describe('inverse, over generated Systems and batches', () => {
  const seeds = Array.from({ length: 60 }, (_, at) => at + 1)

  it('makes batches of every kind of event, so the seeds cover them all', () => {
    const made = new Set(seeds.flatMap((seed) => generated(seed).events.map(({ _tag }) => _tag)))
    expect([...made].sort()).toEqual([
      'ReferenceCreated',
      'ReferenceDeleted',
      'TileCreated',
      'TileDeleted',
      'TileEdited',
      'TileMoved',
      'TilesSwapped',
    ])
  })

  it.each(seeds)('gives back the System a batch ran on, seed %i', (seed) => {
    const { before, events, after } = generated(seed)
    expect(said(undone(after, undoOf(before, events)))).toEqual(said(before))
  })

  it.each(seeds)('gives back the System a batch run twice ran on, seed %i', (seed) => {
    const { before, events, more } = generated(seed)
    const next = more()
    const undo = extended(undoOf(before, events), next.before, next.events)
    expect(said(undone(next.after, undo))).toEqual(said(before))
  })
})
