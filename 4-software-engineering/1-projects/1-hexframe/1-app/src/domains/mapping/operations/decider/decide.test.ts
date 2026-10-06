import { Result, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  type ContextDirection,
  Frontmatter,
  type PlacedTile,
  type Slot,
  type System,
} from '../../entities'
import {
  CreateReference,
  CreateTile,
  type Decided,
  decide,
  DeleteReference,
  DeleteTile,
  EditTile,
  MappingEvent,
  MoveTile,
  type Operation,
  ReferenceCreated,
  ReferenceDeleted,
  SwapTiles,
  TileCreated,
  TileDeleted,
  TileEdited,
  TileMoved,
  TilesSwapped,
} from '..'

// What each Operation does to a System, on Systems made by hand, no database: the events it makes,
// the no-ops that make none, and every refusal, each for the case Mapping refused it before `decide`.
// That the service writes what these events say is `../../agreement.test.ts`'s.

const uuid = () => crypto.randomUUID()

/** The ids of the System below: each Tile's, the Reference's, and one the System doesn't hold. */
const id = {
  root: uuid(),
  branch: uuid(),
  child: uuid(),
  bare: uuid(),
  leaf: uuid(),
  why: uuid(),
  reference: uuid(),
  nowhere: uuid(),
  made: uuid(),
}

const placed = (tileId: string, parent: string, slot: Slot): PlacedTile => ({
  _tag: 'Tile',
  id: tileId,
  title: tileId,
  preview: '',
  body: '',
  parent,
  slot,
})

// The Root, untitled, holds a Branch in Direction 1, which holds a Child in Direction 2; a bare Branch
// in Direction 3; a Leaf in Direction 1, sharing it with the Branch; a Context Tile in -1; and in -2
// a Reference to the Child.
const system: System = {
  root: { _tag: 'Tile', id: id.root, title: '', preview: '', body: '' },
  tiles: {
    [id.branch]: placed(id.branch, id.root, 1),
    [id.child]: placed(id.child, id.branch, 2),
    [id.bare]: placed(id.bare, id.root, 3),
    [id.leaf]: placed(id.leaf, id.root, { leaf: 1 }),
    [id.why]: placed(id.why, id.root, -1),
    [id.reference]: {
      _tag: 'Reference',
      id: id.reference,
      parent: id.root,
      slot: -2,
      target: id.child,
    },
  },
  owned: true,
}

/** Help, made by hand: the same System, owned by no Account. */
const help: System = { ...system, owned: false }

const content = { title: 'New', preview: 'New, in short.', body: '# New' }

/** What a create is given: the id of what it makes. */
const made = { id: id.made }

/** What an Operation does to a System, the one made by hand above unless another is given. */
const decided = (operation: Operation, on: System = system) => decide(on, operation, made)

/** The events an Operation made; a refusal fails the test. */
const eventsOf = (decided: Decided) => Result.getOrThrow(decided)

/** The refusal an Operation got; events fail the test. */
function refusalOf(decided: Decided) {
  if (Result.isSuccess(decided)) throw new Error('No refusal: the Operation made events')
  return decided.failure
}

describe('decide, refusing everything on a System no Account owns', () => {
  it('refuses Help every Operation, even one its System would take', () => {
    const operations: ReadonlyArray<Operation> = [
      new CreateTile({ parent: id.root, slot: 6, ...content }),
      new EditTile({ id: id.branch, title: 'Mine' }),
      new MoveTile({ id: id.bare, parent: id.root, slot: 5 }),
      new SwapTiles({ a: id.branch, b: id.bare }),
      new DeleteTile({ id: id.bare }),
      new CreateReference({ parent: id.root, slot: -3, target: id.bare }),
      new DeleteReference({ parent: id.root, slot: -2 }),
    ]
    for (const operation of operations) {
      expect(eventsOf(decided(operation)).length, operation._tag).toBe(1)
      expect(refusalOf(decided(operation, help)), operation._tag).toMatchObject({
        _tag: 'HelpReadOnly',
        kind: 'Forbidden',
      })
    }
  })

  it('refuses Help first, before any other rule an Operation breaks', () => {
    const broken = new CreateTile({ parent: id.nowhere, slot: 1, ...content, title: '' })
    expect(refusalOf(decided(broken, help))).toMatchObject({ _tag: 'HelpReadOnly' })
  })
})

describe('decide, creating a Tile', () => {
  it('creates it in a free slot, under the id it is given, its Title trimmed', () => {
    const created = decided(
      new CreateTile({ parent: id.branch, slot: 4, ...content, title: ' New ' }),
    )
    expect(eventsOf(created)).toEqual([
      new TileCreated({ id: id.made, parent: id.branch, slot: 4, ...content }),
    ])
  })

  it('creates a Leaf in a Leaf slot, beside the Branch sharing its Direction, and in the Context', () => {
    for (const slot of [{ leaf: 3 }, 6, -6] as const) {
      expect(eventsOf(decided(new CreateTile({ parent: id.root, slot, ...content })))).toEqual([
        new TileCreated({ id: id.made, parent: id.root, slot, ...content }),
      ])
    }
  })

  it('keeps what an import gives it from its file, and nothing it does not give', () => {
    const frontmatter = Schema.decodeUnknownSync(Frontmatter)({ owner: 'diplo' })
    const operation = new CreateTile({ parent: id.root, slot: 6, ...content })
    const [created] = eventsOf(decide(system, operation, { ...made, kept: { frontmatter } }))
    expect(created).toMatchObject({ frontmatter: { owner: 'diplo' } })
    expect(created).not.toHaveProperty('name')
    expect(created).not.toHaveProperty('config')
  })

  it('refuses a Title left empty and a Preview past 350 characters, on the field at fault', () => {
    const untitled = decided(new CreateTile({ parent: id.root, slot: 6, ...content, title: ' ' }))
    expect(refusalOf(untitled)).toMatchObject({ _tag: 'TitleMissing', fields: ['title'] })
    const long = decided(
      new CreateTile({ parent: id.root, slot: 6, ...content, preview: 'x'.repeat(351) }),
    )
    expect(refusalOf(long)).toMatchObject({ _tag: 'PreviewTooLong', fields: ['preview'] })
  })

  it('refuses a parent the System doesn’t hold as a Tile, a Reference among them', () => {
    for (const parent of [id.nowhere, id.reference]) {
      const refused = decided(new CreateTile({ parent, slot: 1, ...content }))
      expect(refusalOf(refused)).toMatchObject({ _tag: 'TileNotFound', kind: 'NotFound' })
    }
  })

  it('refuses anything under a Leaf, and a slot already held, by a Tile or a Reference', () => {
    const underLeaf = decided(new CreateTile({ parent: id.leaf, slot: 1, ...content }))
    expect(refusalOf(underLeaf)).toMatchObject({ _tag: 'LeafHoldsNothing', kind: 'Conflict' })
    for (const slot of [1, { leaf: 1 }, -1, -2] as const) {
      const taken = decided(new CreateTile({ parent: id.root, slot, ...content }))
      expect(refusalOf(taken)).toMatchObject({ _tag: 'DirectionTaken', kind: 'Conflict' })
    }
  })
})

describe('decide, editing a Tile', () => {
  it('edits only the fields given, the Title trimmed, the Root’s like any Tile’s', () => {
    expect(eventsOf(decided(new EditTile({ id: id.root, title: ' Ada ' })))).toEqual([
      new TileEdited({ id: id.root, title: 'Ada' }),
    ])
    expect(eventsOf(decided(new EditTile({ id: id.leaf, body: '' })))).toEqual([
      new TileEdited({ id: id.leaf, body: '' }),
    ])
  })

  it('changes nothing when no field is given', () => {
    expect(eventsOf(decided(new EditTile({ id: id.child })))).toEqual([])
  })

  it('refuses an empty Title, a long Preview, and a Tile it doesn’t hold', () => {
    expect(refusalOf(decided(new EditTile({ id: id.root, title: '' })))).toMatchObject({
      _tag: 'TitleMissing',
    })
    const long = new EditTile({ id: id.root, preview: '😀'.repeat(351) })
    expect(refusalOf(decided(long))).toMatchObject({ _tag: 'PreviewTooLong' })
    for (const tileId of [id.nowhere, id.reference]) {
      expect(refusalOf(decided(new EditTile({ id: tileId, title: 'X' })))).toMatchObject({
        _tag: 'TileNotFound',
      })
    }
  })
})

describe('decide, moving a Tile', () => {
  const move = (tileId: string, parent: string, slot: Slot) =>
    decided(new MoveTile({ id: tileId, parent, slot }))

  it('moves it, with everything below it, to a free slot of any kind, under any Tile but a Leaf', () => {
    expect(eventsOf(move(id.branch, id.bare, -4))).toEqual([
      new TileMoved({ id: id.branch, parent: id.bare, slot: -4 }),
    ])
    expect(eventsOf(move(id.child, id.root, 5))).toEqual([
      new TileMoved({ id: id.child, parent: id.root, slot: 5 }),
    ])
  })

  it('grows a Leaf into a Branch and shrinks a bare Branch into a Leaf, by a move', () => {
    expect(eventsOf(move(id.leaf, id.root, 6))).toHaveLength(1)
    expect(eventsOf(move(id.bare, id.root, { leaf: 3 }))).toHaveLength(1)
  })

  it('changes nothing when the Tile already stands there', () => {
    expect(eventsOf(move(id.child, id.branch, 2))).toEqual([])
    expect(eventsOf(move(id.leaf, id.root, { leaf: 1 }))).toEqual([])
  })

  it('refuses the Root, a Tile it doesn’t hold, and a Reference, which has no place to move', () => {
    expect(refusalOf(move(id.root, id.bare, 1))).toMatchObject({ _tag: 'RootFixed' })
    expect(refusalOf(move(id.nowhere, id.root, 6))).toMatchObject({ _tag: 'TileNotFound' })
    expect(refusalOf(move(id.reference, id.root, -5))).toMatchObject({ _tag: 'TileNotFound' })
    expect(refusalOf(move(id.bare, id.nowhere, 1))).toMatchObject({ _tag: 'TileNotFound' })
  })

  it('refuses a Tile below itself: into itself, or under one of its own', () => {
    expect(refusalOf(move(id.branch, id.branch, 3))).toMatchObject({ _tag: 'MovedUnderItself' })
    expect(refusalOf(move(id.branch, id.child, 3))).toMatchObject({ _tag: 'MovedUnderItself' })
  })

  it('refuses a slot held, a slot under a Leaf, and a Leaf slot to a Tile holding anything', () => {
    expect(refusalOf(move(id.bare, id.root, 1))).toMatchObject({ _tag: 'DirectionTaken' })
    expect(refusalOf(move(id.bare, id.root, -2))).toMatchObject({ _tag: 'DirectionTaken' })
    expect(refusalOf(move(id.bare, id.leaf, 1))).toMatchObject({ _tag: 'LeafHoldsNothing' })
    expect(refusalOf(move(id.branch, id.root, { leaf: 4 }))).toMatchObject({
      _tag: 'LeafHoldsNothing',
    })
  })
})

describe('decide, swapping two Tiles', () => {
  const swap = (a: string, b: string) => decided(new SwapTiles({ a, b }))

  it('swaps two Tiles of any kind, a Branch with a Context Tile or a bare Branch with a Leaf', () => {
    expect(eventsOf(swap(id.branch, id.why))).toEqual([
      new TilesSwapped({ a: id.branch, b: id.why }),
    ])
    expect(eventsOf(swap(id.bare, id.leaf))).toHaveLength(1)
  })

  it('changes nothing when a Tile swaps with itself', () => {
    expect(eventsOf(swap(id.bare, id.bare))).toEqual([])
  })

  it('refuses the Root at either end, a Reference and a Tile it doesn’t hold', () => {
    expect(refusalOf(swap(id.root, id.bare))).toMatchObject({ _tag: 'RootFixed' })
    expect(refusalOf(swap(id.bare, id.root))).toMatchObject({ _tag: 'RootFixed' })
    expect(refusalOf(swap(id.bare, id.reference))).toMatchObject({ _tag: 'TileNotFound' })
    expect(refusalOf(swap(id.nowhere, id.bare))).toMatchObject({ _tag: 'TileNotFound' })
  })

  it('refuses two Tiles along one line, in either order', () => {
    expect(refusalOf(swap(id.branch, id.child))).toMatchObject({ _tag: 'MovedUnderItself' })
    expect(refusalOf(swap(id.child, id.branch))).toMatchObject({ _tag: 'MovedUnderItself' })
  })

  it('refuses a Leaf slot to the Tile holding anything that would take it', () => {
    expect(refusalOf(swap(id.branch, id.leaf))).toMatchObject({ _tag: 'LeafHoldsNothing' })
    expect(refusalOf(swap(id.leaf, id.branch))).toMatchObject({ _tag: 'LeafHoldsNothing' })
  })
})

describe('decide, deleting a Tile', () => {
  it('deletes a Tile, with everything below it, a Leaf or a Context Tile alike', () => {
    for (const tileId of [id.branch, id.leaf, id.why]) {
      expect(eventsOf(decided(new DeleteTile({ id: tileId })))).toEqual([
        new TileDeleted({ id: tileId }),
      ])
    }
  })

  it('refuses the Root, a Reference and a Tile it doesn’t hold', () => {
    expect(refusalOf(decided(new DeleteTile({ id: id.root })))).toMatchObject({
      _tag: 'RootFixed',
    })
    for (const tileId of [id.reference, id.nowhere]) {
      expect(refusalOf(decided(new DeleteTile({ id: tileId })))).toMatchObject({
        _tag: 'TileNotFound',
      })
    }
  })
})

describe('decide, creating and deleting a Reference', () => {
  it('puts a Reference to any Tile of the System, the Root too, in a free Context slot', () => {
    for (const target of [id.child, id.root]) {
      expect(eventsOf(decided(new CreateReference({ parent: id.bare, slot: -1, target })))).toEqual(
        [new ReferenceCreated({ id: id.made, parent: id.bare, slot: -1, target })],
      )
    }
  })

  it('refuses a target it doesn’t hold, a slot held, and a Leaf, which has no Context', () => {
    const create = (parent: string, target: string, slot: ContextDirection = -3) =>
      decided(new CreateReference({ parent, slot, target }))
    expect(refusalOf(create(id.root, id.nowhere))).toMatchObject({ _tag: 'TileNotFound' })
    expect(refusalOf(create(id.root, id.reference))).toMatchObject({ _tag: 'TileNotFound' })
    expect(refusalOf(create(id.nowhere, id.child))).toMatchObject({ _tag: 'TileNotFound' })
    expect(refusalOf(create(id.root, id.child, -1))).toMatchObject({ _tag: 'DirectionTaken' })
    expect(refusalOf(create(id.leaf, id.child))).toMatchObject({ _tag: 'LeafHoldsNothing' })
  })

  it('empties the slot of a Reference, and changes nothing in a slot holding none', () => {
    const empty = (parent: string, slot: ContextDirection) =>
      decided(new DeleteReference({ parent, slot }))
    expect(eventsOf(empty(id.root, -2))).toEqual([
      new ReferenceDeleted({ id: id.reference, parent: id.root, slot: -2 }),
    ])
    expect(eventsOf(empty(id.root, -3))).toEqual([])
    expect(eventsOf(empty(id.root, -1))).toEqual([])
    expect(refusalOf(empty(id.nowhere, -2))).toMatchObject({ _tag: 'TileNotFound' })
  })
})

describe("decide's events", () => {
  it('are each one of Mapping’s events, as its Schema reads them', () => {
    const operations: ReadonlyArray<Operation> = [
      new CreateTile({ parent: id.root, slot: 6, ...content }),
      new EditTile({ id: id.branch, title: 'Mine' }),
      new MoveTile({ id: id.bare, parent: id.root, slot: 5 }),
      new SwapTiles({ a: id.branch, b: id.bare }),
      new DeleteTile({ id: id.bare }),
      new CreateReference({ parent: id.root, slot: -3, target: id.bare }),
      new DeleteReference({ parent: id.root, slot: -2 }),
    ]
    const events = operations.flatMap((operation) => eventsOf(decided(operation)))
    expect(events.map((event) => event._tag)).toEqual([
      'TileCreated',
      'TileEdited',
      'TileMoved',
      'TilesSwapped',
      'TileDeleted',
      'ReferenceCreated',
      'ReferenceDeleted',
    ])
    expect(events.every(Schema.is(MappingEvent))).toBe(true)
  })
})
