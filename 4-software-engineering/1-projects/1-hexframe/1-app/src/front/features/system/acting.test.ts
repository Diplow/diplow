import { describe, expect, it } from 'vitest'

import {
  type PlacedReference,
  type PlacedTile,
  type Slot,
  type System,
  systemOf,
} from '#/domains/mapping/entities'
import { subjectIn } from '#/front/ui/canvas/crossings'
import { layoutCanvas } from '#/front/ui/canvas/geometry/shape'
import type { TileHex } from '#/front/ui/canvas/state/useCanvasState'
import { showView, type CanvasView } from '#/front/ui/canvas/view/view'

import {
  codeOf,
  framesOf,
  moveTo,
  referenceAt,
  subjectOf,
  swapAt,
  turnOf,
  withoutOf,
  type Systems,
} from './acting'
import { canvasTree, tileIn } from './tree'

// A Tile's menu on home, as Mapping reads it, over a System made by hand, flat as the server reads
// it: what the menu says of each Tile, the frames its Add and Move submenus draw, the lines home
// leaves out, and what a line sends, each as Mapping's `decide` would make it.

const placed = (id: string, parent: string, slot: Slot, more: Partial<PlacedTile> = {}) =>
  ({
    _tag: 'Tile',
    id,
    title: id.toUpperCase(),
    preview: `What ${id} is`,
    body: `# ${id}`,
    version: 1,
    parent,
    slot,
    ...more,
  }) as PlacedTile

const reference = (id: string, parent: string, slot: -1 | -2 | -3, target: string) =>
  ({ _tag: 'Reference', id, parent, slot, target }) as PlacedReference

/**
 * The Root holds Holding in 1, which holds the Leaf Inner, beside the Leaf Notes, which clashes with
 * it; Bare, a Branch with nothing below it, in 2; Framed in 3, which holds the Context Tile Why; the
 * file run.yaml, a Leaf, in 4; the Context Tile Principles in -2 and a Reference to Bare in -3.
 */
const flat: System = {
  root: { _tag: 'Tile', id: 'root', title: 'Me', preview: '', body: '', version: 4 },
  tiles: {
    holding: placed('holding', 'root', 1),
    notes: placed('notes', 'root', { leaf: 1 }),
    bare: placed('bare', 'root', 2),
    inner: placed('inner', 'holding', { leaf: 1 }),
    framed: placed('framed', 'root', 3),
    why: placed('why', 'framed', -1),
    'run.yaml': placed(
      'run.yaml',
      'root',
      { leaf: 4 },
      {
        title: 'run.yaml',
        name: 'run.yaml',
        preview: '',
        body: 'version: 1\n',
      },
    ),
    principles: placed('principles', 'root', -2),
    toBare: reference('toBare', 'root', -3, 'bare'),
  },
  owned: true,
  version: 0,
}

const root = systemOf(flat)
const tree = canvasTree(root, { yours: true })
const systems: Systems = { root, flat, tree }

/** The hexes a view draws, each Tile's by its key. */
function hexesOf(view: CanvasView = {}): Record<string, TileHex> {
  const hexes = layoutCanvas(showView(tree, view))
  return Object.fromEntries(
    hexes.flatMap((hex) => (hex.kind === 'tile' ? [[hex.key, hex] as const] : [])),
  )
}

const hex = (key: string, view?: CanvasView) => {
  const found = hexesOf(view)[key]
  if (found === undefined) throw new Error(`No Tile is drawn under ${key}`)
  return found
}

describe('what a menu says of a Tile', () => {
  it('names a Branch of the ring by its Direction, the Tile above it and what is below it', () => {
    expect(subjectOf(systems, hex('tile:holding'))).toEqual({
      kind: 'branch',
      title: 'HOLDING',
      at: 1,
      parent: 'Me',
      below: 1,
      holds: true,
      turns: false,
    })
  })

  it('names a Leaf numbered as a Branch by its own Direction, not the one it is drawn in', () => {
    expect(subjectOf(systems, hex('tile:notes'))).toMatchObject({ kind: 'leaf', at: 1 })
  })

  it('says the user is at the center, above nothing, and takes a new Tile', () => {
    expect(subjectOf(systems, hex('tile:root'))).toEqual({
      kind: 'root',
      title: 'Me',
      at: 'center',
      below: 8,
      holds: true,
      turns: false,
    })
  })

  it('backs a centered Tile out to the one above it', () => {
    expect(subjectOf(systems, hex('tile:framed', { center: 'framed' }))).toMatchObject({
      at: 'center',
      parent: 'Me',
    })
  })

  it('names a Context Tile and a Reference by their slot, a Reference without what is below its Tile', () => {
    const context = hexesOf({ inner: 'context' })
    expect(subjectOf(systems, hex('tile:root:context:2', { inner: 'context' }))).toMatchObject({
      kind: 'context',
      at: 2,
      parent: 'Me',
    })
    const toBare = context['tile:root:context:3']
    expect(toBare && subjectOf(systems, toBare)).toEqual({
      kind: 'reference',
      title: 'BARE',
      at: 3,
      parent: 'Me',
      holds: false,
      turns: false,
    })
  })
})

describe('turning into the other kind', () => {
  it('turns a bare Branch into a Leaf, and a Leaf into a Branch where its Direction is free', () => {
    expect(turnOf(flat, tileIn(root, 'bare'))).toEqual({
      id: 'bare',
      version: 1,
      parent: 'root',
      slot: { leaf: 2 },
    })
    expect(turnOf(flat, tileIn(root, 'run.yaml'))).toEqual({
      id: 'run.yaml',
      version: 1,
      parent: 'root',
      slot: 4,
    })
  })

  it('turns no Branch holding a Child or a Context Tile, no Leaf whose Branch slot is taken', () => {
    for (const id of ['holding', 'framed', 'notes'])
      expect(turnOf(flat, tileIn(root, id))).toBeUndefined()
  })

  it('turns neither the Root nor a Context Tile, nor an id no Tile has', () => {
    for (const id of ['root', 'principles', 'gone'])
      expect(turnOf(flat, tileIn(root, id))).toBeUndefined()
  })
})

describe("a Tile's frames", () => {
  it('draws the ring a Branch holds, where a Tile is added, and the one it stands in', () => {
    const { holds, standsIn } = framesOf(systems, hex('tile:holding'))
    expect(holds).toEqual({ hub: 'HOLDING', seats: { 1: { title: 'INNER', swaps: false } } })
    expect(standsIn?.hub).toBe('Me')
    expect(standsIn?.seats).toEqual({
      1: { title: 'HOLDING', swaps: false },
      2: { title: 'BARE', swaps: true },
      3: { title: 'FRAMED', swaps: true },
      4: { title: 'run.yaml', swaps: false },
    })
    expect([5, 6].map((at) => standsIn?.lands?.(at as 5 | 6))).toEqual([true, true])
  })

  it('draws no ring a Leaf holds, and lands it only in a free Leaf slot', () => {
    const { holds, standsIn } = framesOf(systems, hex('tile:notes'))
    expect(holds).toBeUndefined()
    expect(standsIn?.lands?.(5)).toBe(true)
  })

  it('draws none for a Reference, whose Tile stands elsewhere', () => {
    expect(framesOf(systems, hex('tile:root:context:3', { inner: 'context' }))).toEqual({})
  })
})

describe('what a line sends', () => {
  it('moves a Tile to a free place of its ring, and nowhere Mapping refuses', () => {
    expect(moveTo(systems, hex('tile:holding'), 5)).toEqual({
      id: 'holding',
      version: 1,
      parent: 'root',
      slot: 5,
    })
    expect(moveTo(systems, hex('tile:notes'), 6)).toMatchObject({ slot: { leaf: 6 } })
    expect(moveTo(systems, hex('tile:holding'), 2)).toBeUndefined()
  })

  it('swaps a Tile with the Branch seated where it trades, and with no other', () => {
    expect(swapAt(systems, hex('tile:holding'), 2)).toEqual({
      a: 'holding',
      aVersion: 1,
      b: 'bare',
      bVersion: 1,
    })
    expect(swapAt(systems, hex('tile:holding'), 4)).toBeUndefined()
  })

  it('removes a Reference from its slot, at the Version of the Tile it stands under', () => {
    expect(referenceAt(systems, hex('tile:root:context:3', { inner: 'context' }))).toEqual({
      parent: 'root',
      parentVersion: 4,
      slot: -3,
    })
  })
})

describe('the lines home leaves out', () => {
  it("keeps the agent's in every menu, and leaves a Leaf's Context out", () => {
    expect(withoutOf(systems, hex('tile:holding'))).toEqual([])
    expect(withoutOf(systems, hex('tile:notes'))).toEqual(['show-context'])
  })

  it("leaves the agent's out of a broken Reference's menu, which names no Tile", () => {
    const holding = hex('tile:holding')
    const broken = { ...holding, tile: { ...holding.tile, broken: true as const } }
    expect(withoutOf(systems, broken)).toEqual(['ask-agent'])
  })

  it('leaves out an import as the Root, but into an empty System', () => {
    expect(withoutOf(systems, hex('tile:root'))).toEqual(['import'])
    const empty: System = { ...flat, root: { ...flat.root, title: '' }, tiles: {} }
    const bare = systemOf(empty)
    const alone = canvasTree(bare, { yours: true })
    const [center] = layoutCanvas(showView(alone, {})).filter(
      (drawn): drawn is TileHex => drawn.kind === 'tile',
    )
    expect(center && withoutOf({ root: bare, flat: empty, tree: alone }, center)).toEqual([])
  })
})

describe('what the card shows of a Body', () => {
  it('shows a Leaf that isn’t Markdown as its code', () => {
    expect(codeOf(root, 'run.yaml')).toBe('version: 1\n')
  })

  it('shows no code for a Markdown Leaf, nor a Branch', () => {
    expect(codeOf(root, 'notes')).toBeUndefined()
    expect(codeOf(root, 'bare')).toBeUndefined()
  })
})

describe("the design system's reading of a Tile, on the canvas's tiles alone", () => {
  // `/design-system`'s crossings say what a Tile's menu says of it off the canvas's own tiles, which
  // no Mapping System stands behind there (`ui/canvas/crossings.tsx`'s `subjectIn`): held here to
  // home's on every Tile each view draws, but a Reference, which their fixture holds none of, and what
  // only Mapping says, what is below a Tile and whether it turns into the other kind.
  const views: CanvasView[] = [
    {},
    { inner: 'context' },
    { center: 'holding' },
    { center: 'framed', inner: 'context' },
  ]

  it.each(views)('says what home says of each Tile drawn in %o', (view) => {
    const drawn = Object.values(hexesOf(view)).filter(({ tile }) => tile.reference === undefined)
    expect(drawn.length).toBeGreaterThan(1)
    for (const each of drawn) {
      const home = subjectOf(systems, each)
      expect(home).toBeDefined()
      // What only Mapping says left out, which `toEqual` reads as never said.
      expect(subjectIn(tree, each.tile.id, each.role === 'center')).toEqual({
        ...home,
        below: undefined,
        turns: undefined,
      })
    }
  })
})
