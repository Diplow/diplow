import { describe, expect, it } from 'vitest'

import type { TileNode } from './tiles'
import {
  centerOn,
  readCanvasView,
  showView,
  toggleCenter,
  toggleExpanded,
  viewIn,
  withContext,
  withViewIn,
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
    expect(readCanvasView({ center: 3, frame: 5, inner: 5, expanded: 5 })).toStrictEqual({
      center: undefined,
      frame: undefined,
      inner: undefined,
      expanded: undefined,
    })
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

  it('opens only a Branch of the ring around the center, into a kind it offers', () => {
    const view: CanvasView = {
      frame: 'children',
      expanded: { 1: 'context', 2: 'children', 4: 'leaves', 6: 'context' },
    }
    // 2 holds a Leaf and 6 nothing; b, in 4, offers no Leaves ring, so it opens into its first.
    expect(showView(system, view).expanded).toEqual({ 1: 'context', 4: 'children' })
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
    expect(centerOn(system, 'root')).toEqual({})
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
  it('centers a Tile alone, folded, nothing inside and nothing open', () => {
    expect(centerOn(system, 'a')).toEqual({ center: 'a' })
    expect(centerOn(system, 'many')).toEqual({ center: 'many' })
  })

  it('leaves the center out of the URL for the root', () => {
    expect(centerOn(system, 'root')).toEqual({})
  })

  it('centers a Context Tile and a Leaf too', () => {
    expect(centerOn(system, 'why')).toEqual({ center: 'why' })
    expect(centerOn(system, 'notes')).toEqual({ center: 'notes' })
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
    })
  })

  it('set every field of the canvas’s, and keep the page’s own', () => {
    expect(withViewIn(search, { expanded: { 1: 'children' } })).toStrictEqual({
      center: undefined,
      frame: undefined,
      inner: undefined,
      expanded: { 1: 'children' },
      open: 'why',
    })
  })
})
