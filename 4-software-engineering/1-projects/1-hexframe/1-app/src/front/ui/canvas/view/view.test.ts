import { describe, expect, it } from 'vitest'

import type { TileNode } from './tiles'
import {
  centerOn,
  readCanvasView,
  ringChoices,
  showView,
  toggleExpanded,
  viewIn,
  withFrame,
  withInner,
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

  it('shows the first ring the center offers, nothing inside it and nothing open', () => {
    expect(showView(system, {})).toMatchObject({
      frame: 'children',
      inner: undefined,
      expanded: {},
    })
    expect(showView(system, { center: 'many' })).toMatchObject({ frame: 'branches' })
  })

  it('falls back to the first ring for one the center does not offer', () => {
    expect(showView(system, { frame: 'leaves' }).frame).toBe('children')
    expect(showView(system, { center: 'many', frame: 'children' }).frame).toBe('branches')
    expect(showView(system, { center: 'many', frame: 'leaves' }).frame).toBe('leaves')
  })

  it('shows Leaves inside Branches only, and Context inside any ring', () => {
    expect(showView(system, { inner: 'leaves' }).inner).toBeUndefined()
    expect(showView(system, { inner: 'context' }).inner).toBe('context')
    const many = { center: 'many', inner: 'leaves' } as const
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
      expanded: { 1: 'context', 2: 'children', 4: 'leaves', 6: 'context' },
    }
    // 2 holds a Leaf and 6 nothing; b, in 4, offers no Leaves ring, so it opens into its first.
    expect(showView(system, view).expanded).toEqual({ 1: 'context', 4: 'children' })
  })

  it('opens no Branch around a ring of Leaves', () => {
    const view: CanvasView = { center: 'many', frame: 'leaves', expanded: { 1: 'children' } }
    expect(showView(system, view).expanded).toEqual({})
  })
})

describe('ringChoices', () => {
  it('offers Children around, and Context inside, for six Branches and Leaves or fewer', () => {
    expect(ringChoices(showView(system, {}))).toEqual({ around: ['children'], inside: ['context'] })
  })

  it('offers Branches or Leaves around past six, and Leaves inside Branches', () => {
    const around = ['branches', 'leaves']
    expect(ringChoices(showView(system, { center: 'many' }))).toEqual({
      around,
      inside: ['leaves', 'context'],
    })
    expect(ringChoices(showView(system, { center: 'many', frame: 'leaves' }))).toEqual({
      around,
      inside: ['context'],
    })
  })

  it('offers nothing for a centered Leaf', () => {
    expect(ringChoices(showView(system, { center: 'notes' }))).toEqual({ around: [], inside: [] })
  })
})

describe('toggleExpanded', () => {
  it('opens a Branch into its first ring, then closes it', () => {
    const open = toggleExpanded(system, {}, 1)
    expect(open).toEqual({ expanded: { 1: 'children' } })
    expect(toggleExpanded(system, open, 1)).toEqual({})
  })

  it('opens a Branch of more than six into its Branches', () => {
    expect(toggleExpanded(system, {}, 5)).toEqual({ expanded: { 5: 'branches' } })
  })

  it('opens nothing where no Branch sits, and keeps the rest of the view', () => {
    expect(toggleExpanded(system, { inner: 'context' }, 2)).toEqual({ inner: 'context' })
    expect(toggleExpanded(system, { center: 'a', inner: 'context' }, 3)).toEqual({
      center: 'a',
      inner: 'context',
      expanded: { 3: 'children' },
    })
  })
})

describe('withFrame', () => {
  it('shows another ring around the center, closing what the old one opened', () => {
    const view: CanvasView = { center: 'many', inner: 'context', expanded: { 1: 'children' } }
    expect(withFrame(system, view, 'leaves')).toEqual({
      center: 'many',
      frame: 'leaves',
      inner: 'context',
    })
  })

  it('leaves the first ring out of the URL', () => {
    expect(withFrame(system, { center: 'many', frame: 'leaves' }, 'branches')).toEqual({
      center: 'many',
    })
  })

  it('drops Leaves inside once the ring around is no longer Branches', () => {
    expect(withFrame(system, { center: 'many', inner: 'leaves' }, 'leaves')).toEqual({
      center: 'many',
      frame: 'leaves',
    })
  })
})

describe('withInner', () => {
  it('shows a ring inside the center, then none, leaving no default in the URL', () => {
    const shown = withInner(system, {}, 'context')
    expect(shown).toEqual({ inner: 'context' })
    expect(withInner(system, shown, undefined)).toEqual({})
  })

  it('keeps what is open around', () => {
    expect(withInner(system, { expanded: { 1: 'children' } }, 'context')).toEqual({
      inner: 'context',
      expanded: { 1: 'children' },
    })
  })
})

describe('centerOn', () => {
  it('centers a Tile with its first ring, nothing inside and nothing open', () => {
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
