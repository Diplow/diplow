import { describe, expect, it } from 'vitest'

import type { TileNode } from './tiles'
import {
  aboveOf,
  centerOn,
  cycleOf,
  opens,
  readCanvasView,
  recenter,
  showView,
  showsContext,
  toggleCenter,
  toggleExpanded,
  viewIn,
  withContext,
  withViewIn,
  withoutEmptyRings,
  type CanvasView,
} from './view'

const tile = (id: string, more: Partial<TileNode> = {}): TileNode => ({
  id,
  title: id,
  preview: '',
  ...more,
})

const leaf = (id: string) => tile(id, { leaf: true })

/** Four Branches and three Leaves: seven in all, so its Branches and its Leaves show apart. */
const many = tile('many', {
  branches: { 1: tile('m1'), 2: tile('m2'), 3: tile('m3'), 4: tile('m4') },
  leaves: { 1: leaf('ml1'), 2: leaf('ml2'), 3: leaf('ml3') },
})

const system = tile('root', {
  branches: {
    1: tile('a', { branches: { 3: tile('a3', { branches: { 2: tile('a3b') } }) } }),
    4: tile('b'),
    5: many,
  },
  leaves: { 2: leaf('notes') },
  context: { 2: tile('why') },
})

describe('readCanvasView', () => {
  it('reads each field it understands', () => {
    const view = { center: 'a', frame: 'branches', inner: 'leaves', expanded: { 3: 'context' } }
    expect(readCanvasView(view)).toEqual(view)
  })

  it('leaves out a field it cannot read, and the defaults', () => {
    expect(readCanvasView({})).toEqual({})
    expect(
      readCanvasView({ center: 3, frame: 'context', inner: 'children', expanded: 'a' }),
    ).toEqual({})
    expect(readCanvasView({ center: '', expanded: [] })).toEqual({})
  })

  it('keeps the center alone of a link from before the shape, its expansions a list of ids', () => {
    expect(readCanvasView({ center: 'a', expanded: ['a3'], context: true })).toEqual({
      center: 'a',
    })
  })

  it('drops an expansion it cannot read, and keeps the others', () => {
    expect(readCanvasView({ expanded: { 1: 'children', 2: 'nothing', 7: 'leaves' } })).toEqual({
      expanded: { 1: 'children' },
    })
    expect(readCanvasView({ center: 'x'.repeat(101) })).toEqual({})
  })

  it('sets every field, so a raw value the router keeps underneath is overwritten', () => {
    // Strict, so each key must be there, set to `undefined`, not merely absent.
    expect(readCanvasView({ center: 3, frame: 5, inner: 5, expanded: 5, around: 5 })).toStrictEqual(
      {
        center: undefined,
        frame: undefined,
        inner: undefined,
        expanded: undefined,
        around: undefined,
      },
    )
  })
})

describe('showView', () => {
  it('centers the root when no center is given, or an unknown one', () => {
    expect(showView(system, {}).center).toBe(system)
    expect(showView(system, { center: 'nowhere' }).center).toBe(system)
    expect(showView(system, { center: 'a' }).center.id).toBe('a')
  })

  it('shows the center alone, folded, nothing inside it and nothing open, unless the view opens it', () => {
    expect(showView(system, {})).toMatchObject({
      frame: undefined,
      inner: undefined,
      expanded: {},
    })
    expect(showView(system, { frame: 'children' }).frame).toBe('children')
    expect(showView(system, { center: 'many', frame: 'branches' }).frame).toBe('branches')
  })

  it('falls back to the first ring for one the center does not offer', () => {
    expect(showView(system, { frame: 'leaves' }).frame).toBe('children')
    expect(showView(system, { center: 'many', frame: 'children' }).frame).toBe('branches')
    expect(showView(system, { center: 'many', frame: 'leaves' }).frame).toBe('leaves')
  })

  it('shows Leaves inside Branches only, and Context inside any ring', () => {
    expect(showView(system, { frame: 'children', inner: 'leaves' }).inner).toBeUndefined()
    expect(showView(system, { frame: 'children', inner: 'context' }).inner).toBe('context')
    const many = { center: 'many', frame: 'branches', inner: 'leaves' } as const
    expect(showView(system, many).inner).toBe('leaves')
    expect(showView(system, { ...many, frame: 'leaves' }).inner).toBeUndefined()
  })

  it('shows a centered Leaf alone: no ring around it, none inside, nothing open', () => {
    const view: CanvasView = { center: 'notes', frame: 'children', inner: 'context' }
    expect(showView(system, view)).toMatchObject({
      frame: undefined,
      inner: undefined,
      expanded: {},
    })
  })

  it('opens only a Branch of the ring around the center, into a kind it offers, never its Context', () => {
    const view: CanvasView = {
      frame: 'children',
      expanded: { 1: 'context', 2: 'children', 4: 'leaves', 6: 'context' },
    }
    // 2 holds a Leaf and 6 nothing; b, in 4, offers no Leaves ring, so it opens into its first, as a,
    // in 1, does for its Context, which the center alone shows.
    expect(showView(system, view).expanded).toEqual({ 1: 'children', 4: 'children' })
  })

  it('opens no Branch around a ring of Leaves', () => {
    const view: CanvasView = { center: 'many', frame: 'leaves', expanded: { 1: 'children' } }
    expect(showView(system, view).expanded).toEqual({})
  })

  it('opens the first ring of a link from when it was the default, naming no ring around', () => {
    expect(showView(system, { inner: 'context' })).toMatchObject({
      frame: 'children',
      inner: 'context',
    })
    expect(showView(system, { expanded: { 1: 'children' } })).toMatchObject({
      frame: 'children',
      expanded: { 1: 'children' },
    })
  })
})

describe('toggleCenter', () => {
  it('opens the center into its first ring, then folds it back alone', () => {
    const open = toggleCenter(system, {})
    expect(open).toEqual({ frame: 'children' })
    expect(toggleCenter(system, open)).toEqual({})
  })

  it('opens a center of more than six into its Branches, its Leaves inside it', () => {
    expect(toggleCenter(system, { center: 'many' })).toEqual({
      center: 'many',
      frame: 'branches',
      inner: 'leaves',
    })
  })

  it('folds away what was inside and open', () => {
    const view: CanvasView = { frame: 'children', inner: 'context', expanded: { 1: 'children' } }
    expect(toggleCenter(system, view)).toEqual({})
  })

  it('opens nothing on a centered Leaf', () => {
    expect(toggleCenter(system, { center: 'notes' })).toEqual({ center: 'notes' })
  })
})

describe('toggleExpanded', () => {
  it('opens a Branch into its first ring, then closes it', () => {
    const open = toggleExpanded(system, { frame: 'children' }, 1)
    expect(open).toEqual({ frame: 'children', expanded: { 1: 'children' } })
    expect(toggleExpanded(system, open, 1)).toEqual({ frame: 'children' })
  })

  it('opens a Branch of more than six into its Branches', () => {
    expect(toggleExpanded(system, { frame: 'children' }, 5)).toEqual({
      frame: 'children',
      expanded: { 5: 'branches' },
    })
  })

  it('opens nothing where no Branch sits, nor around a folded center, and keeps the rest', () => {
    const inside = { frame: 'children', inner: 'context' } as const
    expect(toggleExpanded(system, inside, 2)).toEqual(inside)
    expect(toggleExpanded(system, {}, 1)).toEqual({})
    expect(toggleExpanded(system, { center: 'a', ...inside }, 3)).toEqual({
      center: 'a',
      ...inside,
      expanded: { 3: 'children' },
    })
  })
})

describe('withContext', () => {
  it('shows the Context inside the center, opening it were it folded', () => {
    expect(withContext(system, {})).toEqual({ frame: 'children', inner: 'context' })
  })

  it('keeps what is open around', () => {
    const view: CanvasView = { frame: 'children', expanded: { 1: 'children' } }
    expect(withContext(system, view)).toEqual({ ...view, inner: 'context' })
  })
})

describe('centerOn', () => {
  it('centers a Tile opened, as its click opens it, so the Tiles around it show', () => {
    expect(centerOn(system, 'a')).toEqual({ center: 'a', frame: 'children' })
    expect(centerOn(system, 'many')).toEqual({
      center: 'many',
      frame: 'branches',
      inner: 'leaves',
    })
    expect(centerOn(system, 'a')).toEqual(toggleCenter(system, { center: 'a' }))
  })

  it('opens nothing else, what was open or inside left behind', () => {
    const view: CanvasView = { center: 'a', frame: 'children', inner: 'context' }
    expect(showView(system, centerOn(system, 'a3'))).toMatchObject({
      frame: 'children',
      inner: undefined,
      expanded: {},
    })
    expect(centerOn(system, view.center ?? 'root')).toEqual({ center: 'a', frame: 'children' })
  })

  it('leaves the center out of the URL for the root, which a plain URL still shows folded', () => {
    expect(centerOn(system, 'root')).toEqual({ frame: 'children' })
    expect(showView(system, {}).frame).toBeUndefined()
  })

  it('centers a Context Tile opened, and a Leaf alone, which has no ring', () => {
    expect(centerOn(system, 'why')).toEqual({ center: 'why', frame: 'children' })
    expect(centerOn(system, 'notes')).toEqual({ center: 'notes' })
  })
})

describe('the Tiles around the center', () => {
  it('opens those the view names, each into its first ring, with the Branches theirs opens', () => {
    const view: CanvasView = { center: 'a', around: { 1: {}, 4: {}, 5: { 1: 'children' } } }
    // a stands in Direction 1 itself: only the others stand around it.
    expect(showView(system, view).around).toEqual({ 4: {}, 5: { 1: 'children' } })
    expect(readCanvasView({ around: { 5: { 1: 'children', 2: 'nothing' }, 9: {} } })).toEqual({
      around: { 5: { 1: 'children' } },
    })
  })

  it('stands nothing around a center in no ring: the root, a Context Tile', () => {
    expect(showView(system, { around: { 4: {} } }).around).toEqual({})
    expect(showView(system, { center: 'why', around: { 4: {} } }).around).toEqual({})
  })

  it('draws the Tile above opened, those the view opens beside the center opened in it', () => {
    const shown = showView(system, { center: 'a', around: { 5: { 1: 'children' } } })
    expect(aboveOf(system, shown)).toMatchObject({
      center: { id: 'root' },
      frame: 'children',
      expanded: { 5: 'branches' },
    })
    expect(aboveOf(system, showView(system, {}))).toBeUndefined()
  })

  it('closes those holding nothing the reader may add to', () => {
    const shown = showView(system, { center: 'a', around: { 4: {}, 5: {} } })
    expect(withoutEmptyRings(shown, () => false).around).toEqual({ 5: {} })
  })

  it('stay as they are as the center opens or folds', () => {
    const view: CanvasView = { center: 'a', around: { 5: {} } }
    expect(toggleCenter(system, view)).toEqual({ ...view, frame: 'children' })
    expect(toggleCenter(system, toggleCenter(system, view))).toEqual(view)
  })
})

describe('recenter', () => {
  it('goes into a child as it is drawn, the rest of its ring around it as it was', () => {
    const view: CanvasView = { frame: 'children', expanded: { 1: 'children', 5: 'branches' } }
    expect(recenter(system, view, 'a')).toEqual({
      center: 'a',
      frame: 'children',
      around: { 5: {} },
    })
    expect(recenter(system, { frame: 'children' }, 'a')).toEqual({ center: 'a' })
  })

  it('goes out a level, the center opened in the ring of the Tile above, what would be drawn below magnitude 3 folded', () => {
    const view: CanvasView = {
      center: 'a',
      frame: 'children',
      expanded: { 3: 'children' },
      around: { 5: { 1: 'children' } },
    }
    expect(recenter(system, view, 'root')).toEqual({
      frame: 'children',
      expanded: { 1: 'children', 5: 'branches' },
    })
  })

  it('pans to a Tile beside the center, each keeping its state', () => {
    const view: CanvasView = {
      center: 'a',
      frame: 'children',
      expanded: { 3: 'children' },
      around: { 5: { 1: 'children' } },
    }
    const panned = recenter(system, view, 'many')
    expect(panned).toEqual({
      center: 'many',
      frame: 'branches',
      expanded: { 1: 'children' },
      around: { 1: { 3: 'children' } },
    })
    expect(recenter(system, panned, 'a')).toEqual(view)
  })

  it('centers a Tile drawn at magnitude 3 folded, as it was drawn', () => {
    const view: CanvasView = { frame: 'children', expanded: { 1: 'children' } }
    expect(recenter(system, view, 'a3')).toEqual({ center: 'a3' })
  })

  it('opens each Tile above the center onto the way down to it, going out further', () => {
    expect(recenter(system, { center: 'a3', frame: 'children' }, 'root')).toEqual({
      frame: 'children',
      expanded: { 1: 'children' },
    })
    expect(recenter(system, { center: 'why' }, 'root')).toEqual({
      frame: 'children',
      inner: 'context',
    })
  })

  it('lands a Tile the view does not draw as centerOn lands it, and leaves the center be', () => {
    expect(recenter(system, {}, 'a3')).toEqual(centerOn(system, 'a3'))
    const view: CanvasView = { center: 'a', around: { 5: {} } }
    expect(recenter(system, view, 'a')).toEqual(view)
  })
})

describe('opens, showsContext and withoutEmptyRings', () => {
  const nobody = () => false
  const anyone = () => true

  it('opens a Tile onto what it holds, and one holding nothing only where the reader may add to it', () => {
    expect(opens(system, nobody)).toBe(true)
    expect(opens(tile('b'), anyone)).toBe(true)
    expect(opens(tile('b'), nobody)).toBe(false)
    expect(opens(tile('lonely', { context: { 1: tile('c') } }), nobody)).toBe(false)
    expect(opens(leaf('notes'), anyone)).toBe(false)
  })

  it('folds a center holding nothing the reader may add to, but keeps its Context shown', () => {
    const shown = showView(system, centerOn(system, 'b'))
    expect(withoutEmptyRings(shown, nobody)).toMatchObject({ frame: undefined, expanded: {} })
    expect(withoutEmptyRings(shown, anyone)).toEqual(shown)
    const held = tile('root', { branches: { 4: tile('b', { context: { 1: tile('c') } }) } })
    const inside = showView(held, withContext(held, { center: 'b' }))
    expect(withoutEmptyRings(inside, nobody)).toEqual(inside)
  })

  it('shows a Context it holds, and one holding none only where the reader may add to it', () => {
    expect(showsContext(system, nobody)).toBe(true)
    expect(showsContext(tile('b'), anyone)).toBe(true)
    expect(showsContext(tile('b'), nobody)).toBe(false)
    expect(showsContext(leaf('notes'), anyone)).toBe(false)
  })

  it('asks each ring of its own, a Context taking a new Tile where the Children take none', () => {
    const contextOnly = (_: unknown, ring: 'children' | 'context') => ring === 'context'
    expect(showsContext(tile('b'), contextOnly)).toBe(true)
    expect(opens(tile('b'), contextOnly)).toBe(false)
  })

  it('hides a Context holding nothing the reader may add to, the center folded with it', () => {
    const inside = showView(system, withContext(system, { center: 'a' }))
    expect(withoutEmptyRings(inside, nobody)).toMatchObject({ frame: 'children', inner: undefined })
    expect(withoutEmptyRings(inside, anyone)).toEqual(inside)
    const alone = showView(system, withContext(system, { center: 'b' }))
    expect(withoutEmptyRings(alone, nobody)).toMatchObject({ frame: undefined, inner: undefined })
  })

  it('closes a Branch of the ring holding nothing the reader may add to, and keeps the others', () => {
    const shown = showView(system, {
      frame: 'children',
      expanded: { 1: 'children', 4: 'children' },
    })
    expect(withoutEmptyRings(shown, nobody).expanded).toEqual({ 1: 'children' })
    expect(withoutEmptyRings(shown, anyone).expanded).toEqual(shown.expanded)
  })
})

describe('viewIn and withViewIn', () => {
  const search = { center: 'a', frame: 'children', inner: 'context', open: 'why' } as const

  it('take the canvas’s part of a page’s search params', () => {
    expect(viewIn(search)).toEqual({
      center: 'a',
      frame: 'children',
      inner: 'context',
      expanded: undefined,
      around: undefined,
    })
  })

  it('set every field of the canvas’s, and keep the page’s own', () => {
    expect(withViewIn(search, { expanded: { 1: 'children' } })).toStrictEqual({
      center: undefined,
      frame: undefined,
      inner: undefined,
      expanded: { 1: 'children' },
      around: undefined,
      open: 'why',
    })
  })
})

describe('cycleOf, the C key', () => {
  const nobody = () => false
  const anyone = () => true
  const step = (view: CanvasView, fills = anyone) => cycleOf(showView(system, view), fills)

  it('takes the center from alone to its ring, then its Context, then alone again', () => {
    expect(step({})).toBe('expand')
    expect(step({ frame: 'children' })).toBe('show-context')
    expect(step({ frame: 'children', inner: 'context' })).toBe('collapse')
  })

  it('shows the Context in place of the Leaves inside a center of more than six', () => {
    expect(step({ center: 'many', frame: 'branches', inner: 'leaves' })).toBe('show-context')
  })

  it('skips a step that would show nothing, and stays where nothing shows', () => {
    // a holds no Context, nor may the reader add one: its ring folds back.
    expect(step({ center: 'a', frame: 'children' }, nobody)).toBe('collapse')
    // b holds nothing: alone, its Context is all it shows, where the reader may add one.
    expect(step({ center: 'b' }, anyone)).toBe('expand')
    expect(step({ center: 'b' }, nobody)).toBeUndefined()
    expect(step({ center: 'notes' })).toBeUndefined()
  })
})
